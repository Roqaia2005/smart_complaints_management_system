"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("OffensiveMessages", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      session_id: { type: Sequelize.INTEGER, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: false },
      offense_count: { type: Sequelize.INTEGER, defaultValue: 1 },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("OffensiveMessages");
  },
};
