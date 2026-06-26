const authService = require("../services/auth.service");
const { STAFF_SIGNUP_ROLES } = require("../constants/roles");



const submitAdminRequest = async (req, res) => {
  try {
    const result = await authService.submitAdminRequest(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
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
 submitAdminRequest,
  forgotPassword,
  resetPassword,
  login,
};
