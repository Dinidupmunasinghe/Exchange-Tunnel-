module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "Task",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      campaignId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      assignedUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      engagementType: { type: DataTypes.STRING(32), allowNull: false },
      rewardCredits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      status: {
        type: DataTypes.ENUM("open", "assigned", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "open"
      },
      assignedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true }
    },
    {
      tableName: "tasks",
      timestamps: true
    }
  );
};
