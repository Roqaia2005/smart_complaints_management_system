const express = require("express");
const router = express.Router();
const authenticate = require("../../middlewares/auth");
const { isSuperAdmin } = require("../../middlewares/authorize");
const controller = require("../controllers/superAdmin.controller");

router.use(authenticate, isSuperAdmin);

// Registration Requests
router.get("/requests", controller.getAllRequests);
router.get("/requests/pending", controller.getPendingRequests);
router.get("/requests/:id", controller.getRequestById);
router.patch("/requests/:id/approve", controller.approveRequest);
router.patch("/requests/:id/reject", controller.rejectRequest);

// Admin Management
router.get("/admins", controller.getAllAdmins);
router.delete("/admins/:id", controller.deleteAdmin);

module.exports = router;