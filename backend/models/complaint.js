'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Complaint extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

    Complaint.belongsTo(models.User, { foreignKey: "user_id" });
    Complaint.belongsTo(models.Category, { foreignKey: "category_id" });

    // الموظف المسؤول عن حل الشكوى (مختلف عن صاحب الشكوى user_id)
    Complaint.belongsTo(models.User, { foreignKey: "assigned_officer_id", as: "AssignedOfficer" });

    Complaint.hasOne(models.Appeal, { foreignKey: "complaint_id" });
    Complaint.hasMany(models.ComplaintHistory, { foreignKey: "complaint_id" });

    }
  }
Complaint.init({
  user_id: DataTypes.INTEGER,
  category_id: DataTypes.INTEGER,
  problem: DataTypes.TEXT,
  location: DataTypes.STRING,
  since: DataTypes.DATE,
  ai_summary: DataTypes.TEXT,
  priority: DataTypes.INTEGER,
  status: DataTypes.STRING,
  resolution_text: DataTypes.TEXT,
  resolved_at: DataTypes.DATE,
  sla_deadline: DataTypes.DATE,
  assigned_officer_id: DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'Complaint',
  tableName: 'Complaints',
  freezeTableName: true,
  timestamps: true,
  underscored: false,      // ← false عشان الأعمدة camelCase في الداتابيز
  createdAt: 'createdAt',  // ← بتقوله صريح استخدم الاسم ده
  updatedAt: 'updatedAt',  // ← وده
});
  return Complaint;
};