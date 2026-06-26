const express = require("express");
const {
 
  submitAdminRequest,
  forgotPassword,
  resetPassword,
  login,
} = require("../controllers/auth.controller");

const authRoutes = express.Router();

authRoutes.post("/admin/register", submitAdminRequest);

authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

authRoutes.post("/login", login);

module.exports = authRoutes;
