const authService = require("../services/auth.service");
const { STAFF_SIGNUP_ROLES } = require("../constants/roles");

// =========================================================
// STUDENT
// =========================================================

const checkStudent = async (req, res) => {
  try {
    const { student_number } = req.body;

    if (!student_number) {
      return res
        .status(400)
        .json({ success: false, message: "student_number is required." });
    }

    const result = await authService.checkStudent(student_number);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { student_number } = req.body;

    if (!student_number) {
      return res
        .status(400)
        .json({ success: false, message: "student_number is required." });
    }

    const result = await authService.sendOtp(student_number);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { student_number, otp_code } = req.body;

    if (!student_number || !otp_code) {
      return res
        .status(400)
        .json({
          success: false,
          message: "student_number and otp_code are required.",
        });
    }

    const result = await authService.verifyOtp(student_number, otp_code);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const registerStudent = async (req, res) => {
  try {
    const { student_number, password } = req.body;

    if (!student_number || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "student_number and password are required.",
        });
    }

    const result = await authService.registerStudent(student_number, password);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// STAFF (Officer / Manager) — unified, role passed in body
// =========================================================

const sendStaffOtp = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res
        .status(400)
        .json({ success: false, message: "email and role are required." });
    }

    if (!STAFF_SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${STAFF_SIGNUP_ROLES.join(", ")}`,
      });
    }

    const result = await authService.sendStaffOtp(email, role);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const verifyStaffOtp = async (req, res) => {
  try {
    const { email, otp_code, role } = req.body;

    if (!email || !otp_code || !role) {
      return res
        .status(400)
        .json({
          success: false,
          message: "email, otp_code, and role are required.",
        });
    }

    if (!STAFF_SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${STAFF_SIGNUP_ROLES.join(", ")}`,
      });
    }

    const result = await authService.verifyStaffOtp(email, otp_code, role);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const registerStaff = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res
        .status(400)
        .json({
          success: false,
          message: "email, password, and role are required.",
        });
    }

    if (!STAFF_SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${STAFF_SIGNUP_ROLES.join(", ")}`,
      });
    }

    const result = await authService.registerStaff(email, password, role);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// PASSWORD RESET (shared by all roles)
// =========================================================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "email is required." });
    }

    const result = await authService.forgotPassword(email);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;

    if (!email || !otp_code || !new_password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "email, otp_code, and new_password are required.",
        });
    }

    const result = await authService.resetPassword(
      email,
      otp_code,
      new_password,
    );
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// =========================================================
// LOGIN (shared by all roles)
// =========================================================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "email and password are required." });
    }

    const result = await authService.login(email, password);
    return res.json(result);
  } catch (error) {
    let status = 401;

    if (error.message === "Please complete your registration first.") {
      status = 403;
    } else if (error.message.includes("deactivated")) {
      status = 403;
    }

    return res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
