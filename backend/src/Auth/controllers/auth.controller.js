const authService = require("../services/auth.service");
const { ROLES } = require("../constants/roles");

const checkStudent = async (req, res) => {
  try {
    const { student_number } = req.body;
    if (!student_number)
      return res
        .status(400)
        .json({ success: false, message: "student_number is required." });

    const result = await authService.checkStudent(student_number);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { student_number } = req.body;
    if (!student_number)
      return res
        .status(400)
        .json({ success: false, message: "student_number is required." });

    const result = await authService.sendOtp(student_number);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { student_number, otp_code } = req.body;
    if (!student_number || !otp_code)
      return res
        .status(400)
        .json({ success: false, message: "student_number and otp_code are required." });

    const result = await authService.verifyOtp(student_number, otp_code);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const registerStudent = async (req, res) => {
  try {
    const { student_number, password } = req.body;
    if (!student_number || !password)
      return res
        .status(400)
        .json({ success: false, message: "student_number and password are required." });

    const result = await authService.registerStudent(student_number, password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const sendOfficerOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "email is required." });

    const result = await authService.sendStaffOtp(email, ROLES.OFFICER);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const verifyOfficerOtp = async (req, res) => {
  try {
    const { email, otp_code } = req.body;
    if (!email || !otp_code)
      return res
        .status(400)
        .json({ success: false, message: "email and otp_code are required." });

    const result = await authService.verifyStaffOtp(email, otp_code, ROLES.OFFICER);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const registerOfficer = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({
        success: false,
        message: "full_name, email, and password are required.",
      });

    const result = await authService.registerOfficer(full_name, email, password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const sendManagerOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "email is required." });

    const result = await authService.sendStaffOtp(email, ROLES.MANAGER);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const verifyManagerOtp = async (req, res) => {
  try {
    const { email, otp_code } = req.body;
    if (!email || !otp_code)
      return res
        .status(400)
        .json({ success: false, message: "email and otp_code are required." });

    const result = await authService.verifyStaffOtp(email, otp_code, ROLES.MANAGER);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const registerManager = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({
        success: false,
        message: "full_name, email, and password are required.",
      });

    const result = await authService.registerManager(full_name, email, password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "email and password are required." });

    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    const status = error.message === "Your account is pending admin approval." ? 403 : 401;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  checkStudent,
  sendOtp,
  verifyOtp,
  registerStudent,
  sendOfficerOtp,
  verifyOfficerOtp,
  registerOfficer,
  sendManagerOtp,
  verifyManagerOtp,
  registerManager,
  login,
};
