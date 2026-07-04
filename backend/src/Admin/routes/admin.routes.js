const express = require("express");
const multer = require("multer");
const path = require("path");

const authenticate = require("../../Middlewares/auth");
const { isAdmin } = require("../../Middlewares/authorize");
const adminController = require("../controllers/admin.controller");

const adminRoutes = express.Router();

// =========================================================
// Multer setup - temp storage for uploaded CSV files
// =========================================================
const csvUpload = multer({
  dest: path.join(__dirname, "../../../tmp_uploads"),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "text/csv" && !file.originalname.endsWith(".csv")) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Multer setup - temp storage for uploaded regulation PDFs
const pdfUpload = multer({
  dest: path.join(__dirname, "../../../tmp_uploads"),
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype !== "application/pdf" &&
      !file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// All admin routes require a valid token AND the admin (or super_admin) role
adminRoutes.use(authenticate, isAdmin);

// =========================================================
// UNIFIED USER PROVISIONING
// =========================================================
adminRoutes.post("/users/create", adminController.createUserController);
adminRoutes.post(
  "/users/import/preview",
  csvUpload.single("file"),
  adminController.importUsersPreviewController,
);
adminRoutes.post(
  "/users/import/confirm",
  adminController.confirmImportUsersController,
);
adminRoutes.patch(
  "/officers/:id/manager-flag",
  adminController.setOfficerManagerFlagController,
);

// =========================================================
// CATEGORIES
// =========================================================
adminRoutes.get("/categories", adminController.getCategories);
adminRoutes.post("/categories", adminController.addCategory);
adminRoutes.patch("/categories/:id", adminController.patchCategory);
// مثال للرابط: DELETE /api/categories/5
adminRoutes.delete("/categories/:id", adminController.deleteCategoryController);

// ==================== ROUTE: DELETE USER ====================
// مثال للرابط: DELETE /api/users/12
adminRoutes.delete("/users/:id",  adminController.deleteUserController);

// =========================================================
// USERS (general management)
// =========================================================
adminRoutes.get("/users", adminController.getUsers);
adminRoutes.patch("/users/:id", adminController.patchUser);

// =========================================================
// REGULATIONS
// =========================================================
adminRoutes.get("/regulations", adminController.getRegulations);
adminRoutes.post("/regulations", adminController.addRegulation);
adminRoutes.delete("/regulations/:id", adminController.removeRegulation);
adminRoutes.post(
  "/regulations/upload-pdf",
  pdfUpload.single("file"),
  adminController.uploadRegulationPdfController,
);

// =========================================================
// PRIORITY RULES
// =========================================================
adminRoutes.get("/priority-rules", adminController.getRules);
adminRoutes.post("/priority-rules", adminController.savePriorityRule);

// =========================================================
// AUDIT LOGS
// =========================================================
adminRoutes.get("/audit-logs", adminController.getAuditLogs);

// =========================================================
// OFFENSIVE MESSAGES
// =========================================================
adminRoutes.get("/offensive-messages", adminController.getOffensiveMessages);








adminRoutes.get("/uncategorized-complaints", adminController.getUncategorizedComplaintsController);
adminRoutes.patch("/complaints/:id/reassign", adminController.reassignComplaintController);
adminRoutes.post("/complaints/:id/create-category", adminController.createCategoryAndReassignController);
module.exports = adminRoutes;


