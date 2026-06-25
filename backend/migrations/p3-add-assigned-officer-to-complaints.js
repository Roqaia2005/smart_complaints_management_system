"use strict";


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Complaints", "assigned_officer_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Complaints", "assigned_officer_id");
  },
};
