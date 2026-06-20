'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AnalysisReport extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
     AnalysisReport.belongsTo(models.Category, { foreignKey: "category_id" });
    }
  }
  AnalysisReport.init({
    category_id: DataTypes.INTEGER,
    top_issues: DataTypes.JSON,
    generated_at: DataTypes.DATE
  }, {
  sequelize,
  modelName: 'AnalysisReport',
  tableName: 'AnalysisReports',
  freezeTableName: true,
  timestamps: true,
  underscored: false,
  createdAt: false,        // ← الجدول مفيش فيه createdAt
  updatedAt: 'updatedAt'
}
);
  return AnalysisReport;
};