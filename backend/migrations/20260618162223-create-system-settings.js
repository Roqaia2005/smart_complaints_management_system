'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SystemSettings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      university_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email_domain: {
        type: Sequelize.STRING,
        allowNull: false
      },
      otp_expiry_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 300
      },
      support_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SystemSettings');
  }
};
