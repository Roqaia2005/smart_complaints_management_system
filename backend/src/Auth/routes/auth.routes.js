const express = require("express");
const {
  checkStudent,
  sendOtp,
  verifyOtp,
  registerStudent,
  sendStaffOtp,
  verifyStaffOtp,
  registerStaff,
  forgotPassword,
  resetPassword,
  login,
} = require("../controllers/auth.controller");

const authRoutes = express.Router();

// Student flow
authRoutes.post("/check-student", checkStudent);
authRoutes.post("/send-otp", sendOtp);
authRoutes.post("/verify-otp", verifyOtp);
authRoutes.post("/register", registerStudent);

// Staff flow (Officer / Manager) — unified, role in body
authRoutes.post("/staff/send-otp", sendStaffOtp);
authRoutes.post("/staff/verify-otp", verifyStaffOtp);
authRoutes.post("/staff/register", registerStaff);

// Password reset — shared by all roles that already have an account
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

// Shared
authRoutes.post("/login", login);

module.exports = authRoutes;
