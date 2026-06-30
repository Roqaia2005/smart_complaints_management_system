const express = require("express");
const multer = require("multer");
const path = require("path");

const authenticate = require("../../Middlewares/auth");
const { isAdmin } = require("../../Middlewares/authorize");
const adminController = require("../controllers/admin.controller");

const adminRoutes = express.Router();

const csvUpload = multer({
  dest: path.join(__dirname, "../../../tmp_uploads"),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "text/csv" && !file.originalname.endsWith(".csv"))
      return cb(new Error("Only CSV files are allowed"));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const pdfUpload = multer({
  dest: path.join(__dirname, "../../../tmp_uploads"),
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype !== "application/pdf" &&
      !file.originalname.toLowerCase().endsWith(".pdf")
    )
      return cb(new Error("Only PDF files are allowed"));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

adminRoutes.use(authenticate, isAdmin);

// STUDENTS
adminRoutes.post("/students", adminController.createStudentController);
adminRoutes.post(
  "/students/import/preview",
  csvUpload.single("file"),
  adminController.importStudentsPreviewController,
);
adminRoutes.post(
  "/students/import/confirm",
  adminController.confirmImportStudentsController,
);

// STUDENT INFO (department + academic_year for existing students)
adminRoutes.post(
  "/students/info/import/preview",
  csvUpload.single("file"),
  adminController.importStudentInfoPreviewController,
);
adminRoutes.post(
  "/students/info/import/confirm",
  adminController.confirmImportStudentInfoController,
);

// OFFICERS
adminRoutes.post("/officers", adminController.createOfficerController);
adminRoutes.post(
  "/officers/import/preview",
  csvUpload.single("file"),
  adminController.importOfficersPreviewController,
);
adminRoutes.post(
  "/officers/import/confirm",
  adminController.confirmImportOfficersController,
);
adminRoutes.patch(
  "/officers/:id/manager-flag",
  adminController.setOfficerManagerFlagController,
);

// MANAGERS
adminRoutes.post("/managers", adminController.createManagerController);
adminRoutes.post(
  "/managers/import/preview",
  csvUpload.single("file"),
  adminController.importManagersPreviewController,
);
adminRoutes.post(
  "/managers/import/confirm",
  adminController.confirmImportManagersController,
);

// CATEGORIES
adminRoutes.get("/categories", adminController.getCategories);
adminRoutes.post("/categories", adminController.addCategory);
adminRoutes.patch("/categories/:id", adminController.patchCategory);
adminRoutes.delete("/categories/:id", adminController.deleteCategory);

// USERS
adminRoutes.get("/users", adminController.getUsers);
adminRoutes.patch("/users/:id", adminController.patchUser);
adminRoutes.delete("/users/:id", adminController.deleteUser);

// REGULATIONS
adminRoutes.get("/regulations", adminController.getRegulations);
adminRoutes.post("/regulations", adminController.addRegulation);
adminRoutes.delete("/regulations/:id", adminController.removeRegulation);
adminRoutes.post(
  "/regulations/upload-pdf",
  pdfUpload.single("file"),
  adminController.uploadRegulationPdfController,
);

// OFFENSIVE MESSAGES
adminRoutes.get("/offensive-messages", adminController.getOffensiveMessages);

// PRIORITY RULES
adminRoutes.get("/priority-rules", adminController.getRules);
adminRoutes.post("/priority-rules", adminController.savePriorityRule);

// AUDIT LOGS
adminRoutes.get("/audit-logs", adminController.getAuditLogs);

module.exports = adminRoutes;
