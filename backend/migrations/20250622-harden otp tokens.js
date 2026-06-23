"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn("OtpTokens", "otp_code", "otp_hash");

    await queryInterface.addColumn("OtpTokens", "attempts", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("OtpTokens", "purpose", {
      type: Sequelize.ENUM("student_signup", "staff_signup", "password_reset"),
      allowNull: false,
      defaultValue: "student_signup",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("OtpTokens", "purpose");
    await queryInterface.removeColumn("OtpTokens", "attempts");
    await queryInterface.renameColumn("OtpTokens", "otp_hash", "otp_code");
  },
};
