const express = require("express");
const multer = require("multer");
const path = require("path");

const authenticate = require("../../Middlewares/auth");
const { isSuperAdmin } = require("../../Middlewares/authorize");

const {
  submitAdminRequest,
  getPendingAdminRequestsController,
  approveAdminRequestController,
  rejectAdminRequestController,
  studentRequestOtpController,
  studentVerifyAndRegisterController,
  forgotPassword,
  resetPassword,
  changePassword,
  login,
} = require("../controllers/auth.controller");

const authRoutes = express.Router();

// ==================== Multer config for admin registration document ====================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/documents/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error("Only images (jpeg/jpg/png) and PDF files are allowed!"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ==================== ADMIN REGISTRATION REQUEST (public) ====================
authRoutes.post(
  "/admin/register",
  upload.single("supporting_document"),
  submitAdminRequest,
);

// ==================== SUPER ADMIN: review pending admin requests (protected) ====================
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

// ==================== STUDENT REGISTRATION (two steps, public) ====================
authRoutes.post("/student/request-otp", studentRequestOtpController);
authRoutes.post("/student/verify-register", studentVerifyAndRegisterController);

// ==================== PASSWORD RESET (public) ====================
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

// ==================== CHANGE PASSWORD (protected) ====================
authRoutes.patch("/change-password", authenticate, changePassword);

// ==================== LOGIN (public, all roles) ====================
authRoutes.post("/login", login);

module.exports = authRoutes;
