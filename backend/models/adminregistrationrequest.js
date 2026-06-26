'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminRegistrationRequest extends Model {
    static associate(models) {
      // بما إن الطلب لسه ملوش مستخدم أو كلية حقيقية في الـ DB
      // فالعلاقات هنا مش هتربط بحاجة غير لما يحصل Approve
    }
  }

  AdminRegistrationRequest.init({
    full_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    university_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    faculty_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email_domain: {
      type: DataTypes.STRING,
      allowNull: false
    },
    supporting_document: {
      type: DataTypes.STRING, // رابط المستند أو الـ PDF
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      defaultValue: 'Pending',
      allowNull: false
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AdminRegistrationRequest',
    tableName: 'AdminRegistrationRequests',
    timestamps: true, // بيكريت تلقائي createdAt و updatedAt
  });

  return AdminRegistrationRequest;
};