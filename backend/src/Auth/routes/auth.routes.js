const express = require("express");
const multer = require("multer");
const path = require("path");

// استدعاء الـ Middleware الخاص بالـ Auth (تأكدي من صحة المسار عندك)
const authenticate = require("../../Middlewares/auth");

const {
  submitAdminRequest,
  forgotPassword,
  resetPassword,
  changePassword,
  login,
} = require("../controllers/auth.controller");

const authRoutes = express.Router();

// ==================== 📦 Multer Configuration ====================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/documents/"); // الفولدر اللي هيتحفظ فيه إثباتات الهوية
  },
  filename: function (req, file, cb) {
    // تسمية فريدة للملف: اسم الحقل + التاريخ الحالي + الامتداد الأصلي للملف
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

// فلتر للتأكد من إن الملف المرفوع عبارة عن صورة أو PDF فقط لزيادة الأمان
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only images (jpeg/jpg/png) and PDF files are allowed!"));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // الحد الأقصى لحجم الملف: 5 ميجا بايت
});

// ==================== 🛠️ Routes Defintions ====================

// 1. رابط تسجيل الأدمن (يستخدم Multer لاستقبال ملف واحد باسم supporting_document)
authRoutes.post("/admin/register", upload.single("supporting_document"), submitAdminRequest);

// 2. روابط نسيت كلمة المرور وإعادة التعيين (عامة)
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

// 3. رابط تسجيل الدخول (عام)
authRoutes.post("/login", login);

// 4. رابط تغيير كلمة المرور من داخل الحساب (🔒 محمي بالـ Token)
authRoutes.patch("/change-password", authenticate, changePassword);

module.exports = authRoutes;