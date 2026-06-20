'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'faculty_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // null للـ super_admin و student (الطالب بيتربط عن طريق student_id بالفعل)
      references: {
        model: 'faculties',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'faculty_id');
  },
};
