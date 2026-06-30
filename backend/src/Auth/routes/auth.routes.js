const express = require("express");
const {
  submitAdminRequest,
  getPendingAdminRequestsController,
  approveAdminRequestController,
  rejectAdminRequestController,
  studentRequestOtpController,
  studentVerifyAndRegisterController,
  forgotPassword,
  resetPassword,
  login,
} = require("../controllers/auth.controller");

const authenticate = require("../../Middlewares/auth");
const { isSuperAdmin } = require("../../Middlewares/authorize");

const authRoutes = express.Router();

// ADMIN REGISTRATION REQUEST (public, anyone can submit a request)
authRoutes.post("/admin/register", submitAdminRequest);

// SUPER ADMIN: review pending admin requests (protected)
authRoutes.get(
  "/admin/requests/pending",
  authenticate,
  isSuperAdmin,
  getPendingAdminRequestsController,
);
authRoutes.post(
  "/admin/requests/:id/approve",
  authenticate,
  isSuperAdmin,
  approveAdminRequestController,
);
authRoutes.post(
  "/admin/requests/:id/reject",
  authenticate,
  isSuperAdmin,
  rejectAdminRequestController,
);

// STUDENT REGISTRATION (two steps)
authRoutes.post("/student/request-otp", studentRequestOtpController);
authRoutes.post("/student/verify-register", studentVerifyAndRegisterController);

// PASSWORD RESET
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

// LOGIN (all roles use same endpoint)
authRoutes.post("/login", login);

module.exports = authRoutes;
