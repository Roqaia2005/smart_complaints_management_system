'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('OtpTokens', 'student_number', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('OtpTokens', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('OtpTokens', 'signup_role', {
      type: Sequelize.ENUM('officer', 'manager'),
      allowNull: true,
    });

    await queryInterface.addIndex('OtpTokens', ['email']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('OtpTokens', ['email']);
    await queryInterface.removeColumn('OtpTokens', 'signup_role');
    await queryInterface.removeColumn('OtpTokens', 'email');

    await queryInterface.changeColumn('OtpTokens', 'student_number', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_OtpTokens_signup_role";'
    );
  },
};
