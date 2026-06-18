const { User, SystemSetting } = require("../../../models");
const bcrypt = require("bcryptjs");

// ==================== System Settings ====================

const getSystemSettings = async () => {
  const settings = await SystemSetting.findOne();
  if (!settings) throw new Error("No system settings found.");
  return settings;
};

const upsertSystemSettings = async (data) => {
  const settings = await SystemSetting.findOne();

  if (settings) {
    await settings.update(data);
    return settings;
  }

  return await SystemSetting.create(data);
};

// ==================== Admin Management ====================

const getAllAdmins = async () => {
  return await User.findAll({
    where: { role: "admin" },
    attributes: ["id", "full_name", "email", "role", "is_active", "createdAt"],
  });
};

const createAdmin = async ({ full_name, email, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error("Email already exists.");

  const password_hash = await bcrypt.hash(password, 10);

  const admin = await User.create({
    full_name,
    email,
    password_hash,
    role: "admin",
    is_active: true,
  });

  return { user_id: admin.id };
};

const updateAdmin = async (id, data) => {
  const admin = await User.findOne({ where: { id, role: "admin" } });
  if (!admin) throw new Error("Admin not found.");

  if (data.password) {
    data.password_hash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }

  await admin.update(data);
  return admin;
};

const deleteAdmin = async (id) => {
  const admin = await User.findOne({ where: { id, role: "admin" } });
  if (!admin) throw new Error("Admin not found.");

  await admin.update({ is_active: false });
};

module.exports = {
  getSystemSettings,
  upsertSystemSettings,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};