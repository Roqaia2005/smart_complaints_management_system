'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Faculty extends Model {
    static associate(models) {
      Faculty.belongsTo(models.University, { foreignKey: 'university_id' });
      Faculty.hasMany(models.Student, { foreignKey: 'faculty_id' });
      Faculty.hasMany(models.Category, { foreignKey: 'faculty_id' });
      Faculty.hasMany(models.Regulation, { foreignKey: 'faculty_id' });
      Faculty.hasMany(models.User, { foreignKey: 'faculty_id' }); // الأدمن بتاع الكلية
    }
  }
  Faculty.init(
    {
      university_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      email_domain: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      sequelize,
      modelName: 'Faculty',
      tableName: 'faculties',
      freezeTableName: true,
      timestamps: true,
      underscored: false,
    }
  );
  return Faculty;
};