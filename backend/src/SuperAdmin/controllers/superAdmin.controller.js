const superAdminService = require("../services/superAdmin.service");

const getAllAdmins = async (req, res) => {
  try {
    const admins = await superAdminService.getAllAdmins();
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPendingAdmins = async (req, res) => {
  try {
    const admins = await superAdminService.getPendingAdmins();
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAdminById = async (req, res) => {
  try {
    const admin = await superAdminService.getAdminById(req.params.id);
    res.json({ success: true, admin });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const approveAdmin = async (req, res) => {
  try {
    await superAdminService.approveAdmin(req.params.id);
    res.json({ success: true, message: "Admin approved successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const rejectAdmin = async (req, res) => {
  try {
    await superAdminService.rejectAdmin(req.params.id);
    res.json({ success: true, message: "Admin request rejected." });
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
  getAllAdmins,
  getPendingAdmins,
  getAdminById,
  approveAdmin,
  rejectAdmin,
  deleteAdmin,
};