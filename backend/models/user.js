'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Student, { foreignKey: 'student_id' });
      User.belongsTo(models.Faculty, { foreignKey: 'faculty_id' }); // للأدمن: أنهي كلية مسؤول عنها

      User.hasMany(models.Complaint, { foreignKey: 'user_id' });
      User.hasMany(models.AuditLog, { foreignKey: 'user_id' });
      User.hasMany(models.ComplaintHistory, { foreignKey: 'changed_by' });

      User.belongsToMany(models.Category, {
        through: 'category_officers',
        foreignKey: 'officer_id',
      });

      User.hasMany(models.Appeal, {
        foreignKey: 'responded_by',
      });
    }
  }
  User.init(
    {
      student_id: DataTypes.INTEGER,
      faculty_id: DataTypes.INTEGER, // null إلا لو الـ role = admin
      full_name: DataTypes.STRING,
      email: DataTypes.STRING,
      password_hash: DataTypes.STRING,
      role: DataTypes.ENUM('student', 'officer', 'manager', 'admin', 'super_admin'),
      is_active: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      freezeTableName: true,
      timestamps: true,
      underscored: false,
    }
  );
  return User;
};