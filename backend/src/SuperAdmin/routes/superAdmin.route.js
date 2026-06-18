const express = require("express");
const router = express.Router();
const authenticate = require("../../middlewares/auth");
const { isSuperAdmin } = require("../../middlewares/authorize");
const controller = require("../controllers/superAdmin.controller");

// كل الـ routes دي محتاجة super_admin بس
router.use(authenticate, isSuperAdmin);

// System Settings
router.get("/system-settings", controller.getSystemSettings);
router.post("/system-settings", controller.upsertSystemSettings);

// Admin Management
router.get("/admins", controller.getAllAdmins);
router.post("/admins", controller.createAdmin);
router.patch("/admins/:id", controller.updateAdmin);
router.delete("/admins/:id", controller.deleteAdmin);

module.exports = router;