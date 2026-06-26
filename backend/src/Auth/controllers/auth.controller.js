const authService = require("../services/auth.service");

// =========================================================
//  [REGISTER ADMIN REMOVED]
// =========================================================

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

    if (error.message.includes("deactivated")) {
      status = 403;
    }

    return res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
  login,
};