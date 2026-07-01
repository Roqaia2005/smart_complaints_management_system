const authService = require("../services/auth.service");

// ADMIN REGISTRATION REQUEST (multer puts the uploaded file on req.file)

const submitAdminRequest = async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      supporting_document: req.file ? req.file.path : null,
    };

    if (!requestData.supporting_document) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Supporting document file is required.",
        });
    }

    const result = await authService.submitAdminRequest(requestData);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// SUPER ADMIN: review pending admin requests

const getPendingAdminRequestsController = async (req, res) => {
  try {
    const requests = await authService.getPendingAdminRequests();
    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const approveAdminRequestController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await authService.approveAdminRequest(id);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const rejectAdminRequestController = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const result = await authService.rejectAdminRequest(id, rejection_reason);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// STUDENT REGISTRATION

const studentRequestOtpController = async (req, res) => {
  try {
    const { student_number, email } = req.body;
    if (!student_number || !email)
      return res
        .status(400)
        .json({
          success: false,
          message: "student_number and email are required.",
        });
    const result = await authService.studentRequestOtp(student_number, email);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const studentVerifyAndRegisterController = async (req, res) => {
  try {
    const { student_number, email, otp_code, password } = req.body;
    if (!student_number || !email || !otp_code || !password)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "student_number, email, otp_code, and password are required.",
        });
    const result = await authService.studentVerifyOtpAndRegister(
      student_number,
      email,
      otp_code,
      password,
    );
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PASSWORD RESET

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    const result = await authService.forgotPassword(email);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;
    if (!email || !otp_code || !new_password)
      return res
        .status(400)
        .json({
          success: false,
          message: "Email, otp_code, and new_password are required.",
        });
    const result = await authService.resetPassword(
      email,
      otp_code,
      new_password,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// CHANGE PASSWORD (logged-in user, protected route)

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    const result = await authService.changePassword(
      userId,
      current_password,
      new_password,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// LOGIN

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    const result = await authService.login(email, password);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.message.includes("deactivated") ? 403 : 401).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
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
};
