const db = require("../models");
const sequelize = require("../config/database");
const {
  resolveFacebookPostIdFromUrl,
  resolveToNumericPostId
} = require("../services/facebookService");
const { decrypt } = require("../utils/crypto");
const { ENGAGEMENT_TYPES } = require("../constants/engagement");
const { spendCredits, refundCredits } = require("../services/creditService");

function normalizeCampaignName(raw) {
  const s = String(raw || "").trim();
  return s.length > 0 ? s.slice(0, 160) : "Untitled campaign";
}

function parseOptionalSchedule(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function createCampaign(req, res) {
  const {
    name,
    facebookPostId: selectedPostIdRaw,
    facebookPostUrl,
    engagementType,
    creditsPerEngagement,
    maxEngagements,
    scheduledLaunchAt: scheduleRaw
  } = req.body;

  if (!ENGAGEMENT_TYPES.includes(engagementType)) {
    return res.status(400).json({ message: "Invalid engagement type" });
  }

  const selectedPostId =
    typeof selectedPostIdRaw === "string" && /^\d+(_\d+)?$/.test(selectedPostIdRaw.trim())
      ? selectedPostIdRaw.trim()
      : null;

  const rawPostId = selectedPostId || (await resolveFacebookPostIdFromUrl(facebookPostUrl));
  if (!rawPostId) {
    return res.status(400).json({ message: "Invalid Facebook post URL" });
  }

  const scheduledLaunchAt = parseOptionalSchedule(scheduleRaw);
  const now = new Date();
  const launchesLater = scheduledLaunchAt && scheduledLaunchAt > now;
  const status = launchesLater ? "pending" : "active";

  const totalBudget = creditsPerEngagement * maxEngagements;
  const campaignName = normalizeCampaignName(name);

  const owner = await db.User.findByPk(req.user.id);
  if (!owner) {
    return res.status(401).json({ message: "User not found" });
  }
  if (owner.credits < totalBudget) {
    return res.status(400).json({
      message: `Insufficient credits — this campaign needs ${totalBudget} upfront (${creditsPerEngagement} × ${maxEngagements} slots) but you have ${owner.credits}. Earn credits or lower the budget slider.`,
      required: totalBudget,
      balance: owner.credits
    });
  }

  if (!owner.facebookPageId || !owner.facebookPageAccessTokenEncrypted) {
    return res.status(400).json({
      message: "Connect and select your Facebook Page in Settings before creating a campaign."
    });
  }

  // Resolve pfbid → numeric post ID now, using the connected Page token.
  // This accepts permalink.php Page URLs by matching them against the Page's own feed.
  let facebookPostId = rawPostId;
  if (!selectedPostId && /^pfbid/i.test(rawPostId)) {
    const ownerPageToken = decrypt(owner.facebookPageAccessTokenEncrypted);
    const numeric = await resolveToNumericPostId(rawPostId, ownerPageToken, facebookPostUrl);
    if (!numeric || numeric === rawPostId) {
      return res.status(400).json({
        message:
          "Could not verify this Facebook post URL against your selected Page. " +
          "Make sure the post belongs to the Page currently selected in Settings, then open the post on Facebook and copy its direct link again."
      });
    }
    facebookPostId = numeric;
  }

  const createdCampaign = await sequelize.transaction(async (transaction) => {
    const campaign = await db.Campaign.create(
      {
        userId: req.user.id,
        name: campaignName,
        facebookPostId,
        facebookPostUrl,
        engagementType,
        creditsPerEngagement,
        maxEngagements,
        scheduledLaunchAt: launchesLater ? scheduledLaunchAt : null,
        status
      },
      { transaction }
    );

    await spendCredits({
      userId: req.user.id,
      amount: totalBudget,
      reason: `Budget locked for campaign #${campaign.id}`,
      referenceType: "campaign",
      referenceId: campaign.id,
      transaction
    });

    const taskPayload = Array.from({ length: maxEngagements }).map(() => ({
      campaignId: campaign.id,
      engagementType,
      rewardCredits: creditsPerEngagement,
      status: "open"
    }));

    await db.Task.bulkCreate(taskPayload, { transaction });
    return campaign;
  });

  return res.status(201).json({
    message: launchesLater ? "Campaign scheduled" : "Campaign created",
    campaign: createdCampaign
  });
}

async function listMyCampaigns(req, res) {
  const campaigns = await db.Campaign.findAll({
    where: { userId: req.user.id },
    include: [{ model: db.Task, as: "tasks", attributes: ["id", "status"] }],
    order: [["createdAt", "DESC"]]
  });

  const serialized = campaigns.map((campaign) => {
    const completedCount = campaign.tasks.filter((t) => t.status === "completed").length;
    return {
      id: campaign.id,
      name: campaign.name,
      facebookPostUrl: campaign.facebookPostUrl,
      engagementType: campaign.engagementType,
      creditsPerEngagement: campaign.creditsPerEngagement,
      maxEngagements: campaign.maxEngagements,
      completedEngagements: completedCount,
      spentCredits: completedCount * campaign.creditsPerEngagement,
      status: campaign.status,
      scheduledLaunchAt: campaign.scheduledLaunchAt,
      createdAt: campaign.createdAt
    };
  });

  return res.json({ campaigns: serialized });
}

async function patchCampaign(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const { action } = req.body;
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ message: "Invalid campaign id" });
  }

  const campaign = await db.Campaign.findOne({ where: { id, userId: req.user.id } });
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  if (action === "pause") {
    if (campaign.status === "completed") {
      return res.status(400).json({ message: "Cannot pause a completed campaign" });
    }
    if (campaign.status === "paused") {
      return res.status(400).json({ message: "Campaign is already paused" });
    }
    if (!["active", "pending"].includes(campaign.status)) {
      return res.status(400).json({ message: "Cannot pause this campaign" });
    }
    campaign.status = "paused";
    await campaign.save();
    return res.json({ message: "Campaign paused", campaign });
  }

  if (action === "resume") {
    if (campaign.status !== "paused") {
      return res.status(400).json({ message: "Campaign is not paused" });
    }
    const completed = await db.Task.count({
      where: { campaignId: campaign.id, status: "completed" }
    });
    if (completed >= campaign.maxEngagements) {
      campaign.status = "completed";
      await campaign.save();
      return res.json({ message: "Campaign completed", campaign });
    }
    const now = new Date();
    if (campaign.scheduledLaunchAt && new Date(campaign.scheduledLaunchAt) > now) {
      campaign.status = "pending";
    } else {
      campaign.status = "active";
    }
    await campaign.save();
    return res.json({ message: "Campaign resumed", campaign });
  }

  return res.status(400).json({ message: "Invalid action" });
}

async function deleteCampaign(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ message: "Invalid campaign id" });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const campaign = await db.Campaign.findOne({
        where: { id, userId: req.user.id },
        transaction
      });
      if (!campaign) {
        const err = new Error("Campaign not found");
        err.status = 404;
        throw err;
      }

      const completed = await db.Task.count({
        where: { campaignId: campaign.id, status: "completed" },
        transaction
      });
      const refund = (campaign.maxEngagements - completed) * campaign.creditsPerEngagement;

      await db.Engagement.destroy({ where: { campaignId: campaign.id }, transaction });
      await db.Task.destroy({ where: { campaignId: campaign.id }, transaction });
      await campaign.destroy({ transaction });

      if (refund > 0) {
        await refundCredits({
          userId: req.user.id,
          amount: refund,
          reason: `Refund unused budget for deleted campaign #${id}`,
          referenceType: "campaign",
          referenceId: id,
          transaction
        });
      }
    });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ message: e.message });
    }
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: "Could not delete campaign" });
  }

  return res.json({ message: "Campaign deleted" });
}

module.exports = { createCampaign, listMyCampaigns, patchCampaign, deleteCampaign };
