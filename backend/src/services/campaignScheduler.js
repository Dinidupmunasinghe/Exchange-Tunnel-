const { Op } = require("sequelize");
const db = require("../models");

/** Moves scheduled campaigns to active once `scheduledLaunchAt` has passed. */
async function activateDueCampaigns() {
  const [count] = await db.Campaign.update(
    { status: "active" },
    {
      where: {
        status: "pending",
        scheduledLaunchAt: { [Op.lte]: new Date() }
      }
    }
  );
  if (count > 0) {
    // eslint-disable-next-line no-console
    console.log(`[scheduler] Activated ${count} scheduled campaign(s)`);
  }
}

module.exports = { activateDueCampaigns };
