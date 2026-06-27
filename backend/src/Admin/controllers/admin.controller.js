const fs = require("fs");
const adminService = require("../services/admin.service");

// =========================================================
// Helpers
// =========================================================

function getFacultyId(req) {
  return req.user && req.user.faculty_id;
}

function cleanupFile(filePath) {
  if (filePath) {
    fs.unlink(filePath, () => {}); // best-effort, ignore errors
  }
}

// =========================================================
// UNIFIED USER PROVISIONING (Manual Creation)
// =========================================================

// POST /api/admin/users
exports.createUserController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }

    // الدالة دي دلوقتي بتاخد الـ role والـ password والبيانات كلها من الـ body وتوجهها صح
    const result = await adminService.createUserService(req.body, facultyId);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// =========================================================
// UNIFIED CSV BULK IMPORT (Preview + Confirm)
// =========================================================

// POST /api/admin/users/import-preview
exports.importUsersPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    const { targetRole } = req.body; // بنستقبل الـ role المرفوع ليها الملف عشان الـ Validation الديناميكي

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }
    if (!targetRole) {
      return res
        .status(400)
        .json({ success: false, error: "target targetRole is required to parse CSV layout correctly" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    }

    const result = await adminService.importUsersCsvService(
      req.file.path,
      facultyId,
      targetRole
    );
    cleanupFile(req.file.path);

    return res.status(200).json(result);
  } catch (error) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: error.message });
  }
};

// POST /api/admin/users/import-confirm
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

// Promote an existing officer to also have manager access, or revoke it
// PATCH /api/admin/officers/:id/manager-flag
exports.setOfficerManagerFlagController = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_also_manager, manager_title } = req.body;

    const result = await adminService.setOfficerManagerFlag(
      id,
      is_also_manager,
      manager_title
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
    const categories = await adminService.getAllCategories();
    return res.status(200).json({ categories });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const newCat = await adminService.createNewCategory(req.body);
    return res.status(201).json({ success: true, category_id: newCat.id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
    const users = await adminService.getAllUsers();
    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.patchUser = async (req, res) => {
  try {
    await adminService.updateUser(req.params.id, req.body);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// SOFT DELETE USER
exports.deleteUser = async (req, res) => {
  try {
    await adminService.softDeleteUser(req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// =========================================================
// REGULATIONS
// =========================================================

exports.getRegulations = async (req, res) => {
  try {
    const regulations = await adminService.getAllRegulations();
    return res.status(200).json({ regulations });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.addRegulation = async (req, res) => {
  try {
    await adminService.createNewRegulation(req.body);
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.removeRegulation = async (req, res) => {
  try {
    await adminService.deleteRegulation(req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// =========================================================
// PRIORITY RULES
// =========================================================

exports.getRules = async (req, res) => {
  try {
    const rules = await adminService.getPriorityRules();
    return res.status(200).json({ rules });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.savePriorityRule = async (req, res) => {
  try {
    await adminService.upsertPriorityRule(req.body);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// =========================================================
// AUDIT LOGS
// =========================================================

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await adminService.getSystemAuditLogs(req.query);
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