const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Student, User, OtpToken, SystemSetting } = require("../../../models");
const { jwt: jwtConfig, email: emailConfig } = require('../../../config/config');

// ==================== Email Transporter ====================

const createTransporter = () => {
  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: false,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });
};

// ==================== Check Student ====================

const checkStudent = async (student_number) => {
  const student = await Student.findOne({ where: { student_number } });
  if (!student) return { exists: false };

  // تأكد مش عامل account قبل كده
  const existingUser = await User.findOne({
    where: { student_id: student.id },
  });

  if (existingUser) throw new Error("Student already has an account.");

  return {
    exists: true,
    student_data: {
      name: student.full_name,
      email: student.email,
      department: student.department,
      academic_year: student.academic_year,
    },
  };
};

// ==================== Send OTP ====================

const sendOtp = async (student_number) => {
  const student = await Student.findOne({ where: { student_number } });
  if (!student) throw new Error("Student not found.");

  // جيب الـ OTP expiry من SystemSettings
  const settings = await SystemSetting.findOne();
  const expirySeconds = settings?.otp_expiry_seconds || 300;

  // إنشاء OTP
  const otp_code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  // احذف أي OTP قديم للطالب ده
  await OtpToken.destroy({ where: { student_number } });

  // احفظ OTP جديد
  await OtpToken.create({
    student_number,
    otp_code,
    expires_at,
    is_used: false,
  });

  // بعت الـ OTP على الإيميل
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"University Support" <${emailConfig.user}>`,
    to: student.email,
    subject: "Your OTP Code",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Verify Your Email</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 8px; color: #2563eb;">${otp_code}</h1>
        <p>This code expires in ${Math.floor(expirySeconds / 60)} minutes.</p>
      </div>
    `,
  });

  return { success: true, message: "OTP sent to your university email" };
};

// ==================== Verify OTP ====================

const verifyOtp = async (student_number, otp_code) => {
  const otpRecord = await OtpToken.findOne({
    where: { student_number, otp_code, is_used: false },
  });

  if (!otpRecord) throw new Error("Invalid OTP.");

  if (new Date() > otpRecord.expires_at) throw new Error("OTP has expired.");

  // mark as used
  await otpRecord.update({ is_used: true });

  return { success: true };
};

// ==================== Register ====================

const register = async (student_number, password) => {
  const student = await Student.findOne({ where: { student_number } });
  if (!student) throw new Error("Student not found.");

  // تأكد الـ OTP اتعمل verify (is_used = true يعني اتعمل verify)
  const usedOtp = await OtpToken.findOne({
    where: { student_number, is_used: true },
  });
  if (!usedOtp) throw new Error("OTP verification required before registration.");

  // تأكد مش عامل account قبل كده
  const existingUser = await User.findOne({ where: { student_id: student.id } });
  if (existingUser) throw new Error("Account already exists.");

  const password_hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    student_id: student.id,
    full_name: student.full_name,
    email: student.email,
    password_hash,
    role: "student",
    is_active: true,
  });

  const token = jwt.sign({ id: user.id, role: user.role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  return {
    success: true,
    token,
    user: { id: user.id, name: user.full_name, role: user.role },
  };
};

// ==================== Login ====================

const login = async (email, password) => {
  const user = await User.findOne({ where: { email, is_active: true } });
  if (!user) throw new Error("Invalid email or password.");

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new Error("Invalid email or password.");

  const token = jwt.sign({ id: user.id, role: user.role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  return {
    success: true,
    token,
    user: { id: user.id, name: user.full_name, role: user.role },
  };
};

module.exports = { checkStudent, sendOtp, verifyOtp, register, login };