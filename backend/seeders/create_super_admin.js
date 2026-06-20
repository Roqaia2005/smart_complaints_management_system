/**
 * Script لإنشاء أول Super Admin account
 * شغّله مرة واحدة بس: node seeders/create-super-admin.js
 */

const bcrypt = require("bcryptjs");
const { User } = require("../models");

const createSuperAdmin = async () => {
  try {
    const existing = await User.findOne({ where: { role: "super_admin" } });

    if (existing) {
      console.log("Super admin already exists:", existing.email);
      process.exit(0);
    }

    const password_hash = await bcrypt.hash("ChangeThisPassword123!", 10);

    const superAdmin = await User.create({
      full_name: "System Super Admin",
      email: "mayahuma9@gmail.com",
      password_hash,
      role: "super_admin",
      is_active: true,
    });

    console.log("✅ Super admin created successfully!");
    console.log("Email:", superAdmin.email);
    console.log("Password: ChangeThisPassword123!");
    console.log("⚠️  غيّر الباسورد فوراً بعد أول login");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating super admin:", error.message);
    process.exit(1);
  }
};

createSuperAdmin();