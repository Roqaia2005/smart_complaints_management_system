const authService = require("../services/auth.service");

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

const register = async (req, res) => {
  try {
    const { student_number, password } = req.body;
    if (!student_number || !password)
      return res
        .status(400)
        .json({ success: false, message: "student_number and password are required." });

    const result = await authService.register(student_number, password);
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
    res.status(401).json({ success: false, message: error.message });
  }
};

module.exports = { checkStudent, sendOtp, verifyOtp, register, login };