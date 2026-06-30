'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. التشيك باستخدام اسم الجدول الصحيح "users" وبدون حروف كابيتال
    const [existingUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'super_admin' LIMIT 1;`
    );

    if (existingUsers.length > 0) {
      console.log("⚠️ Super admin already exists. Skipping seed.");
      return; 
    }

    // 2. تشفير الباسورد بنفس القيمة القديمة
    const password_hash = await bcrypt.hash("ChangeThisPassword123!", 10);

    // 3. الإدخال في جدول "users" الحقيقي
    await queryInterface.bulkInsert('users', [{
      full_name: 'System Super Admin',
      email: 'mayahuma9@gmail.com',
      password_hash: password_hash,
      role: 'super_admin',
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    console.log("✅ Super admin created successfully!");
    console.log("Email: mayahuma9@gmail.com");
    console.log("⚠️ غيّر الباسورد فوراً بعد أول login");
  },

  down: async (queryInterface, Sequelize) => {
    // التراجع بيمسح من جدول users
    return queryInterface.bulkDelete('users', { email: 'mayahuma9@gmail.com' }, {});
  }
};