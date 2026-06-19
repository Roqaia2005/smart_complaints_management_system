'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OtpToken extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  OtpToken.init({
    student_number: DataTypes.STRING,
    email: DataTypes.STRING,
    signup_role: DataTypes.ENUM('officer', 'manager'),
    otp_code: DataTypes.STRING,
    expires_at: DataTypes.DATE,
    is_used: DataTypes.BOOLEAN
  }, {
  sequelize,
  modelName: 'OtpToken',
  tableName: 'OtpTokens',
  freezeTableName: true,
  timestamps: true,
  underscored: false
  });
  return OtpToken;
};