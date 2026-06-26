const express = require("express");
const {
  forgotPassword,
  resetPassword,
  login,
} = require("../controllers/auth.controller");

const authRoutes = express.Router();

// =========================================================
// PASSWORD RESET (shared by all roles)
// =========================================================
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

// =========================================================
// SHARED ENTRY POINT (Login Only)
// =========================================================
authRoutes.post("/login", login);

module.exports = authRoutes;