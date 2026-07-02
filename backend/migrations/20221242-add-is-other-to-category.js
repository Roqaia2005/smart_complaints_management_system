"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    
    await queryInterface.addColumn("categories", "is_other", {
      type: Sequelize.DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
  },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn("categories", "is_other");
  },
};
