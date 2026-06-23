"use strict";


module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ComplaintAttachments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      complaint_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Complaints", key: "id" },
        onDelete: "CASCADE",
      },
      file_url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ComplaintAttachments");
  },
};
