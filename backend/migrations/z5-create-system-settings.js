"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SystemSettings", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      university_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email_domain: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      otp_expiry_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 300,
      },
      support_email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("SystemSettings");
  },
};
