
'use strict';
const bcrypt = require('bcryptjs'); // أو مكتبة التشفير اللي بتستخدميها (لو مش موجودة استبدليها بـ باسور عادي مؤقتاً)

module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. جلب جميع الطلاب المسجلين حالياً في جدول Students
    const students = await queryInterface.sequelize.query(
      `SELECT id, full_name, email, faculty_id FROM "Students";`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // 2. جلب الـ student_id المسجلين بالفعل في جدول users علشان ما نكررش حساباتهم
    const existingUserStudentIds = await queryInterface.sequelize.query(
      `SELECT student_id FROM "users" WHERE student_id IS NOT NULL;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const excludedIds = existingUserStudentIds.map(u => u.student_id);

    // 3. فلترة الطلاب اللي مالهمش حسابات حالياً
    const studentsNeedAccounts = students.filter(student => !excludedIds.includes(student.id));

    if (studentsNeedAccounts.length === 0) {
      console.log('✅ جميع الطلاب لديهم حسابات بالفعل في جدول users.');
      return;
    }

    // هتعمل باسور مشفر افتراضي للطلبة (مثلاً: student123)
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('student123', salt);

    // 4. تجهيز مصفوفة الحسابات لجدول users
    const usersToInsert = studentsNeedAccounts.map(student => ({
      student_id: student.id,         // الربط بالـ ID الصحيح للطالب
      full_name: student.full_name,
      email: student.email || `student_${student.id}@university.edu.eg`, // حماية لو الإيميل فاضي
      password_hash: defaultPasswordHash,
      role: 'student',                 // الـ role الإلزامي
      is_active: true,
      faculty_id: student.faculty_id,
      is_also_manager: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // 5. إدخال الحسابات في جدول users دفعة واحدة
    await queryInterface.bulkInsert('users', usersToInsert);
    console.log(`\n🚀 تم إنشاء ${usersToInsert.length} حساب بنجاح للطلاب في جدول users.`);
  },

  async down (queryInterface, Sequelize) {
    // التراجع: حذف حسابات الطلاب التي تم إنشاؤها عبر هذا السيديير
    await queryInterface.bulkDelete('users', { role: 'student' }, {});
  }
};