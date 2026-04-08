module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "Campaign",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false, defaultValue: "Untitled campaign" },
      facebookPostId: { type: DataTypes.STRING(255), allowNull: false },
      facebookPostUrl: { type: DataTypes.STRING(512), allowNull: false },
      engagementType: { type: DataTypes.STRING(32), allowNull: false },
      scheduledLaunchAt: { type: DataTypes.DATE, allowNull: true },
      creditsPerEngagement: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      maxEngagements: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      spentCredits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("pending", "active", "paused", "completed"),
        allowNull: false,
        defaultValue: "pending"
      }
    },
    {
      tableName: "campaigns",
      timestamps: true
    }
  );
};
