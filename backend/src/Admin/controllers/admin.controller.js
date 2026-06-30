const fs = require("fs");
const adminService = require("../services/admin.service");

function getFacultyId(req) {
  return req.user && req.user.faculty_id;
}
function cleanupFile(filePath) {
  if (filePath) fs.unlink(filePath, () => {});
}

// STUDENTS

exports.createStudentController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    return res
      .status(201)
      .json(await adminService.createStudentService(req.body, facultyId));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.importStudentsPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    const result = await adminService.importStudentsCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);
    return res.status(200).json(result);
  } catch (e) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.confirmImportStudentsController = async (req, res) => {
  try {
    const { import_id } = req.body;
    if (!import_id)
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    return res
      .status(200)
      .json(await adminService.confirmImportStudentsService(import_id));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

// STUDENT INFO UPDATE (department + academic_year)

exports.importStudentInfoPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    const result = await adminService.importStudentInfoCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);
    return res.status(200).json(result);
  } catch (e) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.confirmImportStudentInfoController = async (req, res) => {
  try {
    const { import_id } = req.body;
    if (!import_id)
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    return res
      .status(200)
      .json(await adminService.confirmImportStudentInfoService(import_id));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

// OFFICERS

exports.createOfficerController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    return res
      .status(201)
      .json(await adminService.createOfficerService(req.body, facultyId));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.importOfficersPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    const result = await adminService.importOfficersCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);
    return res.status(200).json(result);
  } catch (e) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.confirmImportOfficersController = async (req, res) => {
  try {
    const { import_id } = req.body;
    if (!import_id)
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    return res
      .status(200)
      .json(await adminService.confirmImportOfficersService(import_id));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.setOfficerManagerFlagController = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_also_manager, manager_title } = req.body;
    return res
      .status(200)
      .json(
        await adminService.setOfficerManagerFlag(
          id,
          is_also_manager,
          manager_title,
        ),
      );
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

// MANAGERS

exports.createManagerController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    return res
      .status(201)
      .json(await adminService.createManagerService(req.body, facultyId));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.importManagersPreviewController = async (req, res) => {
  try {
    const facultyId = getFacultyId(req);
    if (!facultyId)
      return res
        .status(400)
        .json({ success: false, error: "faculty_id is required" });
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, error: "CSV file is required" });
    const result = await adminService.importManagersCsvService(
      req.file.path,
      facultyId,
    );
    cleanupFile(req.file.path);
    return res.status(200).json(result);
  } catch (e) {
    cleanupFile(req.file?.path);
    return res.status(400).json({ success: false, error: e.message });
  }
};

exports.confirmImportManagersController = async (req, res) => {
  try {
    const { import_id } = req.body;
    if (!import_id)
      return res
        .status(400)
        .json({ success: false, error: "import_id is required" });
    return res
      .status(200)
      .json(await adminService.confirmImportManagersService(import_id));
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

// CATEGORIES

exports.getCategories = (req, res) => {
  adminService
    .getAllCategories()
    .then((c) => res.status(200).json({ categories: c }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.addCategory = (req, res) => {
  adminService
    .createNewCategory(req.body)
    .then((c) => res.status(201).json({ success: true, category_id: c.id }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.patchCategory = (req, res) => {
  adminService
    .updateCategory(req.params.id, req.body)
    .then(() => res.status(200).json({ success: true }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.deleteCategory = (req, res) => {
  adminService
    .softDeleteCategory(req.params.id)
    .then(() => res.status(200).json({ success: true }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

// USERS

exports.getUsers = (req, res) => {
  adminService
    .getAllUsers()
    .then((u) => res.status(200).json({ users: u }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.patchUser = (req, res) => {
  adminService
    .updateUser(req.params.id, req.body)
    .then(() => res.status(200).json({ success: true }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.deleteUser = (req, res) => {
  adminService
    .softDeleteUser(req.params.id)
    .then(() => res.status(200).json({ success: true }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

// REGULATIONS

exports.getRegulations = (req, res) => {
  adminService
    .getAllRegulations()
    .then((r) => res.status(200).json({ regulations: r }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.addRegulation = (req, res) => {
  adminService
    .createNewRegulation(req.body)
    .then(() => res.status(201).json({ success: true }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

exports.removeRegulation = (req, res) => {
  adminService
    .deleteRegulation(req.params.id)
    .then(() => res.status(200).json({ success: true }))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
};

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
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, error: "PDF file is required" });
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
    return res
      .status(500)
      .json({
        success: false,
        error: error.response?.data?.detail || error.message,
      });
  }
};

// OFFENSIVE MESSAGES

exports.getOffensiveMessages = async (req, res) => {
  try {
    return res
      .status(200)
      .json({ messages: await adminService.getOffensiveMessages() });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

// PRIORITY RULES

exports.getRules = async (req, res) => {
  try {
    return res
      .status(200)
      .json({ rules: await adminService.getPriorityRules() });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

exports.savePriorityRule = async (req, res) => {
  try {
    await adminService.upsertPriorityRule(req.body);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

// AUDIT LOGS

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await adminService.getSystemAuditLogs(req.query);
    return res.status(200).json({
      logs: logs.map((log) => ({
        user_name: log.User ? log.User.full_name : "System",
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        created_at: log.createdAt,
      })),
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
