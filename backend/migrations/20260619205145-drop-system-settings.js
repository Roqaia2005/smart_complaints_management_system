'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('SystemSettings');
  },
  async down(queryInterface, Sequelize) {
    // لو احتجت ترجعها تاني، تقدر تعيد إنشاء الجدول هنا
    await queryInterface.createTable('SystemSettings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      university_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email_domain: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      otp_expiry_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 300,
      },
      support_email: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
};
