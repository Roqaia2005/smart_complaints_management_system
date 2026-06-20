'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('faculties', 'university_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // مؤقتاً true عشان الصفوف الموجودة، تقدر تخليها false بعد ما تحدث البيانات القديمة
      references: {
        model: 'Universities',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('faculties', 'university_id');
  },
};
