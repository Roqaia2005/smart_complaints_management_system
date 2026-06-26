'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      
    Category.belongsTo(models.Faculty, { foreignKey: "faculty_id" });

    Category.hasMany(models.Complaint, { foreignKey: "category_id" });
    
    Category.hasMany(models.CategoryKeywords, { foreignKey: "category_id" }); // ضفنا s
    Category.hasMany(models.PriorityRules, { foreignKey: "category_id" });   // ضفنا s
    
    Category.hasMany(models.AiRecommendation, { foreignKey: "category_id" });
    Category.hasMany(models.AnalysisReport, { foreignKey: "category_id" });

    // Many-to-Many
    Category.belongsToMany(models.User, {
    through: models.CategoryOfficer,
      foreignKey: "category_id",
      as: "officers",
    });
    }
  }
  Category.init({
    faculty_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    sla_hours: DataTypes.INTEGER,
    is_active: DataTypes.BOOLEAN
  }, {
  sequelize,
  modelName: 'Category',
  tableName: 'categories',
  freezeTableName: true,
  timestamps: true,
  underscored: false,
  paranoid: false
});
  return Category;
};