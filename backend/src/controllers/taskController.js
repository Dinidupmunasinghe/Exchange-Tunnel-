const { Op } = require("sequelize");
const db = require("../models");
const sequelize = require("../config/database");
const { decrypt } = require("../utils/crypto");
const {
  verifyEngagement,
  likeObjectAsPage,
  unlikeObjectAsPage,
  commentOnObjectAsPage,
  shareLinkAsPage,
  deleteObjectAsPage
} = require("../services/facebookService");
const { earnCredits, refundCredits, reverseEarnCredits } = require("../services/creditService");
const { ENGAGEMENT_TYPES, bundleAllowsAction } = require("../constants/engagement");

function isSuspiciousSubmission(proofText) {
  if (!proofText) return true;
  const repeatedChars = /(.)\1{8,}/.test(proofText);
  const tooShort = proofText.trim().length < 10;
  return repeatedChars || tooShort;
}

/** Campaign is runnable: active, or scheduled time has arrived while still pending. */
function runnableCampaignWhere() {
  return {
    [Op.or]: [
      { status: "active" },
      {
        status: "pending",
        scheduledLaunchAt: { [Op.lte]: new Date() }
      }
    ]
  };
}

function getSelectedPageSession(user) {
  if (!user?.facebookPageId || !user?.facebookPageAccessTokenEncrypted) {
    const error = new Error("Select a Facebook Page in Settings before performing page actions");
    error.status = 400;
    throw error;
  }
  return {
    pageId: user.facebookPageId,
    pageToken: decrypt(user.facebookPageAccessTokenEncrypted)
  };
}

async function getAvailableTasks(req, res) {
  const tasks = await db.Task.findAll({
    where: {
      [Op.or]: [
        {
          status: { [Op.in]: ["open", "assigned"] },
          [Op.or]: [{ assignedUserId: null }, { assignedUserId: req.user.id }]
        },
        {
          status: "completed",
          assignedUserId: req.user.id
        }
      ]
    },
    include: [
      {
        model: db.Campaign,
        as: "campaign",
        required: true,
        where: {
          userId: { [Op.ne]: req.user.id },
          ...runnableCampaignWhere()
        },
        attributes: [
          "id",
          "name",
          "facebookPostUrl",
          "facebookPostId",
          "engagementType",
          "creditsPerEngagement",
          "userId",
          "scheduledLaunchAt",
          "status",
          "createdAt",
          "maxEngagements"
        ]
      }
    ],
    subQuery: false,
    limit: 200,
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ]
  });

  const sanitized = tasks;

  const campaignIds = [...new Set(sanitized.map((t) => t.campaignId))];
  const myEngagements =
    campaignIds.length === 0
      ? []
      : await db.Engagement.findAll({
          where: {
            userId: req.user.id,
            campaignId: { [Op.in]: campaignIds },
            actionKind: { [Op.ne]: null }
          },
          attributes: ["id", "campaignId", "taskId", "actionKind"]
        });

  return res.json({ tasks: sanitized, myEngagements });
}

async function submitTaskCompletion(req, res) {
  const { taskId, engagementType, proofText: proofRaw, actionKind } = req.body;
  const proofText = typeof proofRaw === "string" ? proofRaw : "";

  if (!["like", "comment", "share"].includes(actionKind)) {
    return res.status(400).json({ message: "Invalid action kind" });
  }
  if (!ENGAGEMENT_TYPES.includes(engagementType)) {
    return res.status(400).json({ message: "Invalid engagement type" });
  }
  if (!bundleAllowsAction(engagementType, actionKind)) {
    return res.status(400).json({ message: "This action is not part of this campaign bundle" });
  }

  try {
  const done = await sequelize.transaction(async (transaction) => {
    const task = await db.Task.findByPk(taskId, {
      transaction,
      lock: true,
      include: [{ model: db.Campaign, as: "campaign" }]
    });
    if (!task || task.status === "completed" || task.status === "cancelled") {
      const error = new Error("Task is not available");
      error.status = 404;
      throw error;
    }
    if (task.campaign.userId === req.user.id) {
      const error = new Error("Cannot complete your own campaign task");
      error.status = 400;
      throw error;
    }
    if (task.assignedUserId && task.assignedUserId !== req.user.id) {
      const error = new Error("Task is assigned to another user");
      error.status = 400;
      throw error;
    }

    const c = task.campaign;
    const campaignRunnable =
      c.status !== "paused" &&
      (c.status === "active" ||
        (c.status === "pending" && c.scheduledLaunchAt && new Date(c.scheduledLaunchAt) <= new Date()));
    if (!campaignRunnable) {
      const error = new Error(
        c.status === "paused" ? "Campaign is paused" : "Campaign is not active yet"
      );
      error.status = 400;
      throw error;
    }

    const dup = await db.Engagement.findOne({
      where: {
        userId: req.user.id,
        campaignId: task.campaignId,
        actionKind
      },
      transaction
    });
    if (dup) {
      const error = new Error("You already completed this action on this post");
      error.status = 400;
      throw error;
    }

    const worker = await db.User.findByPk(req.user.id, { transaction, lock: true });
    if (!worker) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    const { pageId, pageToken } = getSelectedPageSession(worker);

    let verifiedViaFacebook = false;
    let actionResponseId = null;
    if (actionKind === "like") {
      await likeObjectAsPage(c.facebookPostId, pageToken, c.facebookPostUrl);
      verifiedViaFacebook = true;
    } else if (actionKind === "comment") {
      if (isSuspiciousSubmission(proofText)) {
        const error = new Error("Comment text is required and must be at least 10 characters");
        error.status = 400;
        throw error;
      }
      const data = await commentOnObjectAsPage(c.facebookPostId, proofText, pageToken, c.facebookPostUrl);
      actionResponseId = data?.id ? String(data.id) : null;
      verifiedViaFacebook = true;
    } else if (actionKind === "share") {
      const data = await shareLinkAsPage(pageId, c.facebookPostUrl, proofText, pageToken);
      actionResponseId = data?.id ? String(data.id) : null;
      verifiedViaFacebook = true;
    }

    task.assignedUserId = req.user.id;
    task.status = "assigned";
    task.assignedAt = task.assignedAt || new Date();
    await task.save({ transaction });

    const verification = await verifyEngagement({
      campaign: task.campaign,
      engagementType,
      proofText,
      verifiedViaFacebook
    });
    if (!verification.isValid) {
      const error = new Error(`Engagement verification failed: ${verification.reason}`);
      error.status = 400;
      throw error;
    }

    await db.Engagement.create(
      {
        userId: req.user.id,
        campaignId: task.campaignId,
        taskId: task.id,
        engagementType,
        actionKind,
        metaEngagementId: actionResponseId || verification.metaEngagementId,
        verificationStatus: "verified",
        verificationDetails: verification.reason
      },
      { transaction }
    );

    task.status = "completed";
    task.completedAt = new Date();
    await task.save({ transaction });

    await earnCredits({
      userId: req.user.id,
      amount: task.rewardCredits,
      reason: `Earned from ${actionKind} on campaign #${task.campaignId} (task #${task.id})`,
      referenceType: "task",
      referenceId: task.id,
      transaction
    });

    const completedCount = await db.Task.count({
      where: { campaignId: task.campaignId, status: "completed" },
      transaction
    });

    if (completedCount >= task.campaign.maxEngagements) {
      task.campaign.status = "completed";
      await task.campaign.save({ transaction });
    }

    return task;
  });

  return res.json({ message: "Task completed and credits added", task: done });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Could not complete task" });
  }
}

async function revertEngagement(req, res) {
  const { campaignId, actionKind } = req.body;

  if (!["like", "comment", "share"].includes(actionKind)) {
    return res.status(400).json({ message: "Invalid action kind" });
  }

  try {
  await sequelize.transaction(async (transaction) => {
    const engagement = await db.Engagement.findOne({
      where: { userId: req.user.id, campaignId, actionKind },
      transaction,
      lock: true,
      include: [
        { model: db.Task, as: "task", required: true },
        { model: db.Campaign, as: "campaign", required: true }
      ]
    });

    if (!engagement) {
      const error = new Error("No engagement to undo");
      error.status = 404;
      throw error;
    }

    const campaign = engagement.campaign;
    const task = engagement.task;
    const ownerId = campaign.userId;

    if (ownerId === req.user.id) {
      const error = new Error("Cannot revert on your own campaign");
      error.status = 400;
      throw error;
    }

    const worker = await db.User.findByPk(req.user.id, { transaction, lock: true });
    const { pageToken } = getSelectedPageSession(worker);

    if (actionKind === "like") {
      await unlikeObjectAsPage(campaign.facebookPostId, pageToken, campaign.facebookPostUrl);
    } else {
      if (!engagement.metaEngagementId) {
        const error = new Error("Facebook object ID missing for this action");
        error.status = 400;
        throw error;
      }
      await deleteObjectAsPage(engagement.metaEngagementId, pageToken);
    }

    const amount = task.rewardCredits;

    await reverseEarnCredits({
      userId: req.user.id,
      amount,
      reason: `Reverted ${actionKind} on campaign #${campaignId} (task #${task.id})`,
      referenceType: "task",
      referenceId: task.id,
      transaction
    });

    await refundCredits({
      userId: ownerId,
      amount,
      reason: `Refund: ${actionKind} reverted on campaign #${campaignId}`,
      referenceType: "campaign",
      referenceId: campaign.id,
      transaction
    });

    await engagement.destroy({ transaction });

    task.status = "open";
    task.assignedUserId = null;
    task.assignedAt = null;
    task.completedAt = null;
    await task.save({ transaction });

    if (campaign.status === "completed") {
      const stillCompleted = await db.Task.count({
        where: { campaignId: campaign.id, status: "completed" },
        transaction
      });
      if (stillCompleted < campaign.maxEngagements) {
        campaign.status = "active";
        await campaign.save({ transaction });
      }
    }
  });

  return res.json({ message: "Engagement reverted; credits returned to the poster" });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Could not revert engagement" });
  }
}

module.exports = { getAvailableTasks, submitTaskCompletion, revertEngagement };
