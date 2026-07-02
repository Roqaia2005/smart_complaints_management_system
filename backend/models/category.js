"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.belongsTo(models.Faculty, { foreignKey: "faculty_id" });
      Category.hasMany(models.Complaint, { foreignKey: "category_id" });
      Category.hasMany(models.CategoryKeywords, { foreignKey: "category_id" });
      Category.hasMany(models.PriorityRules, { foreignKey: "category_id" });
      Category.hasMany(models.AiRecommendation, { foreignKey: "category_id" });
      Category.hasMany(models.AnalysisReport, { foreignKey: "category_id" });
      Category.belongsToMany(models.User, {
        through: models.CategoryOfficer,
        foreignKey: "category_id",
        as: "officers",
      });
    }
  }

  Category.init(
    {
      faculty_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      description: DataTypes.STRING,
      sla_hours: DataTypes.INTEGER,
      is_active: DataTypes.BOOLEAN,
      is_other: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Category",
      tableName: "categories",
      freezeTableName: true,
      timestamps: true,
      underscored: false,
      paranoid: false,
    },
  );

  return Category;
};
