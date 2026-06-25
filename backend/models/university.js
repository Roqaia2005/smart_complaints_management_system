'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class University extends Model {
    static associate(models) {
      University.hasMany(models.Faculty, { foreignKey: 'university_id' });
    }
  }
  University.init(
    {
      name: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'University',
      tableName: 'Universities',
      freezeTableName: true,
      timestamps: true,
      underscored: false,
    }
  );
  return University;
};