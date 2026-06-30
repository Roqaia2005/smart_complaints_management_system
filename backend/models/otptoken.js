'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OtpToken extends Model {
    static associate(models) {
      // هنا ربطنا الـ OTP بجدول الـ Students
      OtpToken.belongsTo(models.Student, {
        foreignKey: 'student_id',
        as: 'student'
      });
    }
  }
  
  OtpToken.init(
    {
      // التعديل هنا: شيلنا student_number وضفنا student_id
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: true // خليه يقبل Null لأن الموظفين مش طلاب ومعندهمش student_id
      },
      email: DataTypes.STRING,
      signup_role: DataTypes.ENUM("officer", "manager"),
      purpose: DataTypes.ENUM(
        "student_signup",
        "staff_signup",
        "password_reset",
      ),
      otp_hash: DataTypes.STRING,
      attempts: DataTypes.INTEGER,
      expires_at: DataTypes.DATE,
      is_used: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "OtpToken",
      tableName: "OtpTokens",
      freezeTableName: true,
      timestamps: true,
      underscored: false,
    },
  );

  return OtpToken;
};