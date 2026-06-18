const superAdminService = require("../services/superAdmin.service");

// ==================== System Settings ====================

const getSystemSettings = async (req, res) => {
  try {
    const settings = await superAdminService.getSystemSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const upsertSystemSettings = async (req, res) => {
  try {
    const { university_name, email_domain, otp_expiry_seconds, support_email } =
      req.body;

    const settings = await superAdminService.upsertSystemSettings({
      university_name,
      email_domain,
      otp_expiry_seconds,
      support_email,
    });

    res.json({ success: true, settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==================== Admin Management ====================

const getAllAdmins = async (req, res) => {
  try {
    const admins = await superAdminService.getAllAdmins();
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAdmin = async (req, res) => {
  try {
    const result = await superAdminService.createAdmin(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateAdmin = async (req, res) => {
  try {
    await superAdminService.updateAdmin(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    await superAdminService.deleteAdmin(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSystemSettings,
  upsertSystemSettings,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};