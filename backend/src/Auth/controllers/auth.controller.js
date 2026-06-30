const authService = require("../services/auth.service");

// =========================================================
// 1. ADMIN REGISTRATION REQUEST (طلب تسجيل أدمن الكلية)
// =========================================================
const submitAdminRequest = async (req, res) => {
  try {
    // لقط البيانات النصية + مسار الملف المرفوع بواسطة Multer
    const requestData = {
      ...req.body,
      supporting_document: req.file ? req.file.path : null // حفظ مسار الملف في قاعدة البيانات
    };

    // فحص بسيط للتأكد من رفع المستند الداعم
    if (!requestData.supporting_document) {
      return res.status(400).json({ success: false, message: "Supporting document file is required." });
    }

    const result = await authService.submitAdminRequest(requestData);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// 2. FORGOT PASSWORD (طلب إعادة التعيين - إرسال OTP)
// =========================================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }

    const result = await authService.forgotPassword(email);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// 3. RESET PASSWORD (تطبيق إعادة التعيين باستخدام الـ OTP)
// =========================================================
const resetPassword = async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;

    if (!email || !otp_code || !new_password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email, otp_code, and new_password are required.",
        });
    }

    const result = await authService.resetPassword(email, otp_code, new_password);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// 4. CHANGE PASSWORD (تغيير كلمة المرور من داخل الحساب - محمية)
// =========================================================
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id; // حماية: جلب الـ ID من الـ Token الموثق
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required."
      });
    }

    const result = await authService.changePassword(userId, current_password, new_password);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// 5. LOGIN (تسجيل الدخول الموحد)
// =========================================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const result = await authService.login(email, password);
    return res.status(200).json(result);
  } catch (error) {
    let status = 401;

    if (error.message.includes("deactivated")) {
      status = 403;
    }

    return res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  submitAdminRequest,
  forgotPassword,
  resetPassword,
  changePassword, 
  login,
};