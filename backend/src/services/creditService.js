const { Op } = require("sequelize");
const env = require("../config/env");
const db = require("../models");

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function spendCredits({ userId, amount, reason, referenceType, referenceId, transaction }) {
  const user = await db.User.findByPk(userId, { transaction, lock: true });
  if (!user) throw new Error("User not found");
  if (user.credits < amount) {
    const err = new Error("Insufficient credits");
    err.status = 400;
    throw err;
  }
  user.credits -= amount;
  await user.save({ transaction });

  await db.Transaction.create(
    {
      userId,
      type: "spend",
      amount: -Math.abs(amount),
      reason,
      referenceType,
      referenceId
    },
    { transaction }
  );

  return user.credits;
}

/** Adds credits without applying the daily earn cap (e.g. campaign refunds). */
async function refundCredits({ userId, amount, reason, referenceType, referenceId, transaction }) {
  const n = Math.floor(Number(amount));
  if (n <= 0) return null;
  const user = await db.User.findByPk(userId, { transaction, lock: true });
  if (!user) throw new Error("User not found");
  user.credits += n;
  await user.save({ transaction });
  await db.Transaction.create(
    {
      userId,
      type: "earn",
      amount: n,
      reason,
      referenceType,
      referenceId
    },
    { transaction }
  );
  return user.credits;
}

async function canEarnCreditsToday({ userId, amount, transaction }) {
  const user = await db.User.findByPk(userId, { transaction, lock: true });
  if (!user) throw new Error("User not found");
  const today = getTodayDateString();
  if (user.dailyEarnedAt !== today) {
    user.dailyEarnedAt = today;
    user.dailyEarnedCredits = 0;
  }
  const allowed = user.dailyEarnedCredits + amount <= env.limits.dailyEarnLimit;
  return { user, allowed };
}

/** Take back credits that were earned (e.g. user removed a like). Adjusts daily earn when applicable. */
async function reverseEarnCredits({ userId, amount, reason, referenceType, referenceId, transaction }) {
  const n = Math.floor(Number(amount));
  if (n <= 0) return null;
  const user = await db.User.findByPk(userId, { transaction, lock: true });
  if (!user) throw new Error("User not found");
  if (user.credits < n) {
    const err = new Error("Cannot revert — not enough credits on your balance");
    err.status = 400;
    throw err;
  }
  user.credits -= n;
  const today = getTodayDateString();
  if (user.dailyEarnedAt === today && user.dailyEarnedCredits >= n) {
    user.dailyEarnedCredits -= n;
  }
  await user.save({ transaction });
  await db.Transaction.create(
    {
      userId,
      type: "spend",
      amount: -n,
      reason,
      referenceType,
      referenceId
    },
    { transaction }
  );
  return user.credits;
}

async function earnCredits({ userId, amount, reason, referenceType, referenceId, transaction }) {
  const check = await canEarnCreditsToday({ userId, amount, transaction });
  if (!check.allowed) {
    const err = new Error("Daily earning limit reached");
    err.status = 400;
    throw err;
  }
  const user = check.user;
  user.credits += amount;
  user.dailyEarnedCredits += amount;
  await user.save({ transaction });

  await db.Transaction.create(
    {
      userId,
      type: "earn",
      amount: Math.abs(amount),
      reason,
      referenceType,
      referenceId
    },
    { transaction }
  );

  return user.credits;
}

function getRewardByType(type) {
  if (type === "like") return env.limits.likeReward;
  if (type === "comment") return env.limits.commentReward;
  return env.limits.shareReward;
}

async function listTransactionsForUser(userId, limit = 50) {
  return db.Transaction.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
    limit
  });
}

async function getDashboardStats(userId) {
  const campaigns = await db.Campaign.findAll({ where: { userId } });
  const tx = await db.Transaction.findAll({
    where: {
      userId,
      createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 3600 * 1000) }
    }
  });
  const activeCampaigns = campaigns.filter((c) => {
    if (c.status === "active") return true;
    if (
      c.status === "pending" &&
      c.scheduledLaunchAt &&
      new Date(c.scheduledLaunchAt) <= new Date()
    ) {
      return true;
    }
    return false;
  }).length;
  const creditsEarned30d = tx.filter((t) => t.type === "earn").reduce((sum, t) => sum + t.amount, 0);
  const creditsSpent30d = Math.abs(tx.filter((t) => t.type === "spend").reduce((sum, t) => sum + t.amount, 0));
  return { activeCampaigns, creditsEarned30d, creditsSpent30d };
}

module.exports = {
  spendCredits,
  earnCredits,
  reverseEarnCredits,
  refundCredits,
  getRewardByType,
  listTransactionsForUser,
  getDashboardStats
};
