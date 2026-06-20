const express = require("express");
const router = express.Router();
const authenticate = require("../../middlewares/auth");
const { isSuperAdmin } = require("../../middlewares/authorize");
const controller = require("../controllers/superAdmin.controller");

router.use(authenticate, isSuperAdmin);

router.get("/admins", controller.getAllAdmins);
router.get("/admins/pending", controller.getPendingAdmins);
router.get("/admins/:id", controller.getAdminById);
router.patch("/admins/:id/approve", controller.approveAdmin);
router.patch("/admins/:id/reject", controller.rejectAdmin);
router.delete("/admins/:id", controller.deleteAdmin);

module.exports = router;