const superAdminService = require("../services/superAdmin.service");

// ==================== Registration Requests ====================

const getAllRequests = async (req, res) => {
  try {
    const requests = await superAdminService.getAllRequests();
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const requests = await superAdminService.getPendingRequests();
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRequestById = async (req, res) => {
  try {
    const request = await superAdminService.getRequestById(req.params.id);
    res.json({ success: true, request });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const approveRequest = async (req, res) => {
  try {
    const result = await superAdminService.approveRequest(req.params.id);
    res.json({ success: true, ...result, message: "Admin approved and account created." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    await superAdminService.rejectRequest(req.params.id, rejection_reason);
    res.json({ success: true, message: "Request rejected." });
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

const deleteAdmin = async (req, res) => {
  try {
    await superAdminService.deleteAdmin(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllRequests,
  getPendingRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  getAllAdmins,
  deleteAdmin,
};