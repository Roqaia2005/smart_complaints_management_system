'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
 SystemSetting.init({
  university_name: DataTypes.STRING,
  email_domain: DataTypes.STRING,
  otp_expiry_seconds: DataTypes.INTEGER,
  support_email: DataTypes.STRING
}, {
  sequelize,
  modelName: 'SystemSetting',
  tableName: 'SystemSettings',
  freezeTableName: true,
  timestamps: true,
  underscored: false,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});
  return SystemSetting;
};