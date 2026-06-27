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
const upload = multer({
  dest: path.join(__dirname, "../../../tmp_uploads"),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "text/csv" && !file.originalname.endsWith(".csv")) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// All admin routes require a valid token AND the admin (or super_admin) role
adminRoutes.use(authenticate, isAdmin);

// =========================================================
// UNIFIED USER PROVISIONING 
// =========================================================

// إنشاء مستخدم جديد يدوياً (الأدمن بيحدد الـ role والـ password في الـ Body)
adminRoutes.post("/users/create", adminController.createUserController);

// معاينة ملف الـ CSV الموحد قبل التأكيد
adminRoutes.post(
  "/users/import/preview",
  upload.single("file"),
  adminController.importUsersPreviewController
);

// تأكيد الحفظ النهائي لبيانات الـ CSV في الداتا بيز
adminRoutes.post("/users/import/confirm", adminController.confirmImportUsersController);

// تفعيل أو إلغاء صلاحية الـ Manager للموظفين
adminRoutes.patch(
  "/officers/:id/manager-flag",
  adminController.setOfficerManagerFlagController
);

// =========================================================
// CATEGORIES
// =========================================================
adminRoutes.get("/categories", adminController.getCategories);
adminRoutes.post("/categories", adminController.addCategory);
adminRoutes.patch("/categories/:id", adminController.patchCategory);
adminRoutes.delete("/categories/:id", adminController.deleteCategory);

// =========================================================
// USERS (general management)
// =========================================================
adminRoutes.get("/users", adminController.getUsers);
adminRoutes.patch("/users/:id", adminController.patchUser);
adminRoutes.delete("/users/:id", adminController.deleteUser);

// =========================================================
// REGULATIONS
// =========================================================
adminRoutes.get("/regulations", adminController.getRegulations);
adminRoutes.post("/regulations", adminController.addRegulation);
adminRoutes.delete("/regulations/:id", adminController.removeRegulation);

// =========================================================
// PRIORITY RULES
// =========================================================
adminRoutes.get("/priority-rules", adminController.getRules);
adminRoutes.post("/priority-rules", adminController.savePriorityRule);

// =========================================================
// AUDIT LOGS
// =========================================================
adminRoutes.get("/audit-logs", adminController.getAuditLogs);

module.exports = adminRoutes;