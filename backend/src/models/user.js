const { encrypt } = require("../utils/crypto");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: true },
      facebookUserId: { type: DataTypes.STRING(80), allowNull: true },
      facebookAccessTokenEncrypted: { type: DataTypes.TEXT, allowNull: true },
      facebookPageId: { type: DataTypes.STRING(80), allowNull: true },
      facebookPageName: { type: DataTypes.STRING(160), allowNull: true },
      facebookPageAccessTokenEncrypted: { type: DataTypes.TEXT, allowNull: true },
      credits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      dailyEarnedCredits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      dailyEarnedAt: { type: DataTypes.DATEONLY, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    },
    {
      tableName: "users",
      timestamps: true
    }
  );

  User.prototype.setFacebookToken = function setFacebookToken(accessToken) {
    this.facebookAccessTokenEncrypted = encrypt(accessToken);
  };

  User.prototype.setFacebookPageToken = function setFacebookPageToken(page) {
    this.facebookPageId = page.id;
    this.facebookPageName = page.name;
    this.facebookPageAccessTokenEncrypted = encrypt(page.accessToken);
  };

  User.prototype.clearFacebookPage = function clearFacebookPage() {
    this.facebookPageId = null;
    this.facebookPageName = null;
    this.facebookPageAccessTokenEncrypted = null;
  };

  return User;
};
