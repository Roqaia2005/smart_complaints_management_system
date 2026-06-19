const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Student, User, OtpToken, SystemSetting } = require("../../../models");
const { jwt: jwtConfig, email: emailConfig } = require('../../../config/config');
const { ROLES, STAFF_SIGNUP_ROLES } = require('../constants/roles');
const { isEmailAllowed } = require('../helpers/emailDomain');

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

const getEmailDomain = async () => {
  const settings = await SystemSetting.findOne();
  return settings?.email_domain || null;
};

const getOtpExpirySeconds = async () => {
  const settings = await SystemSetting.findOne();
  return settings?.otp_expiry_seconds || 300;
};

const hashPassword = (password) => bcrypt.hash(password, 10);

const generateAuthResponse = (user) => {
  const token = jwt.sign({ id: user.id, role: user.role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  return {
    success: true,
    token,
    user: { id: user.id, name: user.full_name, role: user.role },
  };
};

const validatePassword = (password) => {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
};

const sendOtpEmail = async (to, otp_code, expirySeconds) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"University Support" <${emailConfig.user}>`,
    to,
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
};

// ==================== Check Student ====================

const checkStudent = async (student_number) => {
  const student = await Student.findOne({ where: { student_number } });
  if (!student) return { exists: false };

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

// ==================== Send OTP (Student) ====================

const sendOtp = async (student_number) => {
  const student = await Student.findOne({ where: { student_number } });
  if (!student) throw new Error("Student not found.");

  const expirySeconds = await getOtpExpirySeconds();
  const otp_code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  await OtpToken.destroy({ where: { student_number } });

  await OtpToken.create({
    student_number,
    otp_code,
    expires_at,
    is_used: false,
  });

  await sendOtpEmail(student.email, otp_code, expirySeconds);

  return { success: true, message: "OTP sent to your university email" };
};

// ==================== Verify OTP (Student) ====================

const verifyOtp = async (student_number, otp_code) => {
  const otpRecord = await OtpToken.findOne({
    where: { student_number, otp_code, is_used: false },
  });

  if (!otpRecord) throw new Error("Invalid OTP.");

  if (new Date() > otpRecord.expires_at) throw new Error("OTP has expired.");

  await otpRecord.update({ is_used: true });

  return { success: true };
};

// ==================== Register Student ====================

const registerStudent = async (student_number, password) => {
  validatePassword(password);

  const student = await Student.findOne({ where: { student_number } });
  if (!student) throw new Error("Student not found.");

  const usedOtp = await OtpToken.findOne({
    where: { student_number, is_used: true },
  });
  if (!usedOtp) throw new Error("OTP verification required before registration.");

  const existingUser = await User.findOne({ where: { student_id: student.id } });
  if (existingUser) throw new Error("Account already exists.");

  const password_hash = await hashPassword(password);

  const user = await User.create({
    student_id: student.id,
    full_name: student.full_name,
    email: student.email,
    password_hash,
    role: ROLES.STUDENT,
    is_active: true,
  });

  return generateAuthResponse(user);
};

// ==================== Staff OTP (Officer / Manager) ====================

const sendStaffOtp = async (email, role) => {
  if (!STAFF_SIGNUP_ROLES.includes(role)) {
    throw new Error("Invalid role for staff signup.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailDomain = await getEmailDomain();
  if (!isEmailAllowed(normalizedEmail, emailDomain)) {
    throw new Error(`Email must use the configured university domain (${emailDomain}).`);
  }

  const existingUser = await User.findOne({ where: { email: normalizedEmail } });
  if (existingUser) throw new Error("An account with this email already exists.");

  const expirySeconds = await getOtpExpirySeconds();
  const otp_code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  await OtpToken.destroy({ where: { email: normalizedEmail, signup_role: role } });

  await OtpToken.create({
    email: normalizedEmail,
    signup_role: role,
    otp_code,
    expires_at,
    is_used: false,
  });

  await sendOtpEmail(normalizedEmail, otp_code, expirySeconds);

  return { success: true, message: "OTP sent to your university email" };
};

const verifyStaffOtp = async (email, otp_code, role) => {
  if (!STAFF_SIGNUP_ROLES.includes(role)) {
    throw new Error("Invalid role for staff signup.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const otpRecord = await OtpToken.findOne({
    where: { email: normalizedEmail, signup_role: role, otp_code, is_used: false },
  });

  if (!otpRecord) throw new Error("Invalid OTP.");

  if (new Date() > otpRecord.expires_at) throw new Error("OTP has expired.");

  await otpRecord.update({ is_used: true });

  return { success: true };
};

// ==================== Register Staff (Officer / Manager) ====================

const registerStaff = async (full_name, email, password, role) => {
  if (!STAFF_SIGNUP_ROLES.includes(role)) {
    throw new Error("Invalid role for staff signup.");
  }

  validatePassword(password);

  const normalizedEmail = email.trim().toLowerCase();
  const emailDomain = await getEmailDomain();
  if (!isEmailAllowed(normalizedEmail, emailDomain)) {
    throw new Error(`Email must use the configured university domain (${emailDomain}).`);
  }

  const usedOtp = await OtpToken.findOne({
    where: { email: normalizedEmail, signup_role: role, is_used: true },
  });
  if (!usedOtp) throw new Error("OTP verification required before registration.");

  const existingUser = await User.findOne({ where: { email: normalizedEmail } });
  if (existingUser) throw new Error("Account already exists.");

  const password_hash = await hashPassword(password);

  const user = await User.create({
    full_name: full_name.trim(),
    email: normalizedEmail,
    password_hash,
    role,
    is_active: false,
  });

  return {
    success: true,
    message: "Registration submitted. Your account is pending admin approval before you can log in.",
    user: { id: user.id, name: user.full_name, role: user.role, is_active: user.is_active },
  };
};

const registerOfficer = (full_name, email, password) =>
  registerStaff(full_name, email, password, ROLES.OFFICER);

const registerManager = (full_name, email, password) =>
  registerStaff(full_name, email, password, ROLES.MANAGER);

// ==================== Login ====================

const login = async (email, password) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) throw new Error("Invalid email or password.");

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new Error("Invalid email or password.");

  if (!user.is_active) {
    throw new Error("Your account is pending admin approval.");
  }

  return generateAuthResponse(user);
};

module.exports = {
  checkStudent,
  sendOtp,
  verifyOtp,
  registerStudent,
  sendStaffOtp,
  verifyStaffOtp,
  registerOfficer,
  registerManager,
  login,
};
