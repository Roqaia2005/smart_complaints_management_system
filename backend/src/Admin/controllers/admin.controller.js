const fs = require("fs");
const adminService = require("../services/admin.service");
const { User } = require("../../../models");

function getFacultyId(req) {
  return req.user && req.user.faculty_id;
}

function cleanupFile(filePath) {
  if (filePath) {
    fs.unlink(filePath, () => {});
  }
}

// =========================================================
// UNIFIED USER PROVISIONING (Manual Creation)
// =========================================================

exports.createUserController = async (req, res) => {
  try {
    const admin = await User.findByPk(req.user.id);
    const facultyId = admin?.faculty_id;

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: "Admin is not linked to any faculty.",
      });
    }

    const result = await adminService.createUserService(req.body, facultyId);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// =========================================================
// UNIFIED CSV BULK IMPORT (Preview + Confirm)
// =========================================================

exports.importUsersPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const { targetRole } = req.body;

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }
    if (!targetRole) {
      return res
        .status(400)
        .json({
          success: false,
          error: "targetRole is required to parse CSV layout correctly",
        });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    }

    const result = await adminService.importUsersCsvService(
      req.file.path,
      facultyId,
      targetRole,
    );
    cleanupFile(req.file.path);

    return res.status(200).json(result);
  } catch (error) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.confirmImportUsersController = async (req, res) => {
  try {
    const { import_id } = req.body;

    if (!import_id) {
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    }

    const result = await adminService.confirmImportUsersService(import_id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.setOfficerManagerFlagController = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_also_manager, manager_title } = req.body;
    const facultyId = getFacultyId(req);

    const result = await adminService.setOfficerManagerFlag(
      id,
      is_also_manager,
      manager_title,
      facultyId,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// =========================================================
// CATEGORIES
// =========================================================

exports.getCategories = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const categories = await adminService.getAllCategories(facultyId);
    return res.status(200).json({ categories });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const { name, description, sla_hours, keywords } = req.body;
    const facultyId = getFacultyId(req);

    if (!name || !sla_hours) {
      return res.status(400).json({
        success: false,
        message: "Name and SLA hours are required.",
      });
    }

    const categoryData = {
      name,
      description,
      sla_hours,
      keywords,
      faculty_id: facultyId,
    };

    const newCategory = await adminService.createNewCategory(categoryData);

    return res.status(201).json({
      success: true,
      message: "Category created successfully without officer assignment.",
      category: newCategory,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

exports.patchCategory = async (req, res) => {
  try {
    await adminService.updateCategory(req.params.id, req.body);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await adminService.softDeleteCategory(req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// =========================================================
// USERS (general management)
// =========================================================

exports.getUsers = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const users = await adminService.getAllUsers(facultyId);
    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.patchUser = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const adminId = req.user?.id;

    if (Number(req.params.id) === Number(adminId)) {
      return res.status(400).json({
        success: false,
        error:
          "You cannot activate/deactivate your own admin account from here.",
      });
    }

    await adminService.updateUser(req.params.id, req.body, facultyId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const adminId = req.user?.id;

    if (Number(req.params.id) === Number(adminId)) {
      return res.status(400).json({
        success: false,
        error: "You cannot delete your own admin account.",
      });
    }

    await adminService.softDeleteUser(req.params.id, facultyId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// =========================================================
// REGULATIONS
// =========================================================

exports.getRegulations = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const regulations = await adminService.getAllRegulations(facultyId);
    return res.status(200).json({ regulations });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.addRegulation = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    await adminService.createNewRegulation(req.body, facultyId);
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.removeRegulation = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    await adminService.deleteRegulation(req.params.id, facultyId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// PDF regulation upload -> forwarded to the Python service, which parses
// and indexes it for the chatbot's RAG search (faculty_id taken from the
// authenticated admin's own token, never trusted from the request body).
exports.uploadRegulationPdfController = async (req, res) => {
  const axios = require("axios");
  const FormData = require("form-data");
  const { pythonService } = require("../../../config/config");
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId) {
      cleanupFile(req.file?.path);
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "PDF file is required" });
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path), {
      filename: req.file.originalname || "regulation.pdf",
      contentType: "application/pdf",
    });
    form.append("faculty_id", String(facultyId));

    const response = await axios.post(
      `${pythonService.baseUrl}/api/regulations/upload`,
      form,
      { headers: form.getHeaders(), timeout: 60000 },
    );

    cleanupFile(req.file.path);
    return res.status(200).json(response.data);
  } catch (error) {
    cleanupFile(req.file?.path);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.detail || error.message,
    });
  }
};

// =========================================================
// PRIORITY RULES
// =========================================================

exports.getRules = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const rules = await adminService.getPriorityRules(facultyId);
    return res.status(200).json({ rules });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.savePriorityRule = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    await adminService.upsertPriorityRule(req.body, facultyId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// =========================================================
// AUDIT LOGS
// =========================================================

exports.getAuditLogs = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const logs = await adminService.getSystemAuditLogs(req.query, facultyId);
    const formattedLogs = logs.map((log) => ({
      user_name: log.User ? log.User.full_name : "System",
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      created_at: log.createdAt,
    }));
    return res.status(200).json({ logs: formattedLogs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// =========================================================
// OFFENSIVE MESSAGES
// =========================================================

exports.getOffensiveMessages = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const messages = await adminService.getOffensiveMessages(facultyId);
    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};


exports.getUncategorizedComplaintsController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId) return res.status(400).json({ success: false, error: "faculty_id is required" });
    const complaints = await adminService.getUncategorizedComplaints(facultyId);
    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

exports.reassignComplaintController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const { id } = req.params;
    const { category_id } = req.body;
    if (!category_id) return res.status(400).json({ success: false, error: "category_id is required" });
    const result = await adminService.reassignComplaint(id, category_id, facultyId);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.createCategoryAndReassignController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const { id } = req.params;
    const { name, description, sla_hours, keywords } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });
    const result = await adminService.createCategoryAndReassign(
      id, { name, description, sla_hours, keywords }, facultyId
    );
    return res.status(201).json(result);
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};