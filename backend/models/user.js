"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Student, { foreignKey: "student_id" });
      User.belongsTo(models.Faculty, { foreignKey: "faculty_id" });

      User.hasMany(models.Complaint, { foreignKey: "user_id" });
      User.hasMany(models.AuditLog, { foreignKey: "user_id" });
      User.hasMany(models.ComplaintHistory, { foreignKey: "changed_by" });

     User.belongsToMany(models.Category, {
  through: models.CategoryOfficer, // استخدم الموديل مش الـ String
  foreignKey: "officer_id",       // الكي بتاع الموديل الحالي (User) جوه جدول الـ pivot
  otherKey: "category_id",         // الكي بتاع الموديل التاني (Category) جوه جدول الـ pivot
  as: "categories",                // الـ alias اختياري بس يفضل تكتبه
});

      User.hasMany(models.Appeal, {
        foreignKey: "responded_by",
      });
    }
  }

  User.init(
    {
      student_id: DataTypes.INTEGER,
      faculty_id: DataTypes.INTEGER,
      full_name: DataTypes.STRING,
      email: DataTypes.STRING,
      password_hash: DataTypes.STRING,
      role: DataTypes.ENUM(
        "student",
        "officer",
        "manager",
        "admin",
        "super_admin",
      ),
      is_active: DataTypes.BOOLEAN,
      is_also_manager: DataTypes.BOOLEAN,
      manager_title: DataTypes.STRING,
      officer_title: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      freezeTableName: true,
      timestamps: true,
      underscored: false,
    },
  );

  return User;
};
