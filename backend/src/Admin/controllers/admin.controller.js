
const fs = require("fs");
const adminService = require("../services/admin.service");
// when i remove async error changes from get categories is not a function to await on top level
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
// STUDENTS
// =========================================================

exports.createStudentController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }

    const result = await adminService.createStudentService(req.body, facultyId);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.importStudentsPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    }

    const result = await adminService.importStudentsCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);

    return res.status(200).json(result);
  } catch (error) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.confirmImportStudentsController = async (req, res) => {
  try {
    const { import_id } = req.body;

    if (!import_id) {
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    }

    const result = await adminService.confirmImportStudentsService(import_id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// =========================================================
// OFFICERS
// =========================================================

exports.createOfficerController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }

    const result = await adminService.createOfficerService(req.body, facultyId);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.importOfficersPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    }

    const result = await adminService.importOfficersCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);

    return res.status(200).json(result);
  } catch (error) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.confirmImportOfficersController = async (req, res) => {
  try {
    const { import_id } = req.body;

    if (!import_id) {
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    }

    const result = await adminService.confirmImportOfficersService(import_id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// Promote an existing officer to also have manager access, or revoke it
exports.setOfficerManagerFlagController = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_also_manager, manager_title } = req.body;

    const result = await adminService.setOfficerManagerFlag(
      id,
      is_also_manager,
      manager_title,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// =========================================================
// MANAGERS
// =========================================================

exports.createManagerController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }

    const result = await adminService.createManagerService(req.body, facultyId);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.importManagersPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);

    if (!facultyId) {
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    }

    const result = await adminService.importManagersCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);

    return res.status(200).json(result);
  } catch (error) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: error.message });
  }
};

exports.confirmImportManagersController = async (req, res) => {
  try {
    const { import_id } = req.body;

    if (!import_id) {
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    }

    const result = await adminService.confirmImportManagersService(import_id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// =========================================================
// CATEGORIES
// =========================================================

exports.getCategories = (req, res) => {
  adminService
    .getAllCategories()
    .then((categories) => res.status(200).json({ categories }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.addCategory = (req, res) => {
  adminService
    .createNewCategory(req.body)
    .then((newCat) =>
      res.status(201).json({ success: true, category_id: newCat.id }),
    )
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.patchCategory = (req, res) => {
  adminService
    .updateCategory(req.params.id, req.body)
    .then(() => res.status(200).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.deleteCategory = (req, res) => {
  adminService
    .softDeleteCategory(req.params.id)
    .then(() => res.status(200).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

// =========================================================
// USERS (general management)
// =========================================================

exports.getUsers = (req, res) => {
  adminService
    .getAllUsers()
    .then((users) => res.status(200).json({ users }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.patchUser = (req, res) => {
  adminService
    .updateUser(req.params.id, req.body)
    .then(() => res.status(200).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.deleteUser = (req, res) => {
  adminService
    .softDeleteUser(req.params.id)
    .then(() => res.status(200).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

// =========================================================
// REGULATIONS
// =========================================================

exports.getRegulations = (req, res) => {
  adminService
    .getAllRegulations()
    .then((regulations) => res.status(200).json({ regulations }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.addRegulation = (req, res) => {
  adminService
    .createNewRegulation(req.body)
    .then(() => res.status(201).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.removeRegulation = (req, res) => {
  adminService
    .deleteRegulation(req.params.id)
    .then(() => res.status(200).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

// =========================================================
// PRIORITY RULES
// =========================================================

exports.getRules = (req, res) => {
  adminService
    .getPriorityRules()
    .then((rules) => res.status(200).json({ rules }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

exports.savePriorityRule = (req, res) => {
  adminService
    .upsertPriorityRule(req.body)
    .then(() => res.status(200).json({ success: true }))
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};

// =========================================================
// AUDIT LOGS
// =========================================================

exports.getAuditLogs = (req, res) => {
  adminService
    .getSystemAuditLogs(req.query)
    .then((logs) => {
      const formattedLogs = logs.map((log) => ({
        user_name: log.User ? log.User.full_name : "System",
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        created_at: log.createdAt,
      }));
      res.status(200).json({ logs: formattedLogs });
    })
    .catch((err) =>
      res.status(500).json({ success: false, error: err.message }),
    );
};
