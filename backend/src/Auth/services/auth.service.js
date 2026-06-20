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

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

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

// =========================================================================
// STUDENT FLOW
// The Admin already created the Student record (via create or CSV import)
// in the `Students` table. The student then verifies their email via OTP
// and sets their own password, which creates their `User` record.
// =========================================================================

// ==================== Check Student Exists ====================

const checkStudent = async (student_number) => {
  const student = await Student.findOne({ where: { student_number } });

  if (!student) {
    return { exists: false };
  }

  const existingUser = await User.findOne({
    where: { student_id: student.id },
  });

  if (existingUser) {
    return {
      exists: true,
      already_registered: true,
      student_data: {
        name: student.full_name,
        email: student.email,
        department: student.department,
        academic_year: student.academic_year,
      },
    };
  }

  return {
    exists: true,
    already_registered: false,
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

  const existingUser = await User.findOne({ where: { student_id: student.id } });
  if (existingUser) throw new Error("This student already has an account. Please log in.");

  const expirySeconds = await getOtpExpirySeconds();
  const otp_code = generateOtpCode();
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

  const existingUser = await User.findOne({ where: { student_id: student.id } });
  if (existingUser) throw new Error("Account already exists. Please log in.");

  const usedOtp = await OtpToken.findOne({
    where: { student_number, is_used: true },
  });
  if (!usedOtp) throw new Error("OTP verification required before registration.");

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

// =========================================================================
// STAFF FLOW (Officer / Manager)
// The Admin already created the User record (email + role, NO password)
// via create or CSV import. The staff member verifies their email via OTP
// and sets their own password, which completes (updates) that same record.
// =========================================================================

// ==================== Send OTP (Officer / Manager) ====================

const sendStaffOtp = async (email, role) => {
  if (!STAFF_SIGNUP_ROLES.includes(role)) {
    throw new Error("Invalid role for staff signup.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const emailDomain = await getEmailDomain();
  if (!isEmailAllowed(normalizedEmail, emailDomain)) {
    throw new Error(`Email must use the configured university domain (${emailDomain}).`);
  }

  const user = await User.findOne({
    where: { email: normalizedEmail, role }
  });

  if (!user) {
    throw new Error("This email was not found. Please contact your administrator.");
  }

  if (user.password_hash) {
    throw new Error("This account is already registered. Please log in.");
  }

  const expirySeconds = await getOtpExpirySeconds();
  const otp_code = generateOtpCode();
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

// ==================== Verify OTP (Officer / Manager) ====================

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

const registerStaff = async (email, password, role) => {
  if (!STAFF_SIGNUP_ROLES.includes(role)) {
    throw new Error("Invalid role for staff signup.");
  }

  validatePassword(password);

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    where: { email: normalizedEmail, role }
  });

  if (!user) {
    throw new Error("This email was not found. Please contact your administrator.");
  }

  if (user.password_hash) {
    throw new Error("This account is already registered. Please log in.");
  }

  const usedOtp = await OtpToken.findOne({
    where: { email: normalizedEmail, signup_role: role, is_used: true },
  });

  if (!usedOtp) {
    throw new Error("OTP verification required before registration.");
  }

  const password_hash = await hashPassword(password);

  await user.update({
    password_hash,
    is_active: true
  });

  return generateAuthResponse(user);
};

const registerOfficer = (email, password) =>
  registerStaff(email, password, ROLES.OFFICER);

const registerManager = (email, password) =>
  registerStaff(email, password, ROLES.MANAGER);

const sendOfficerOtp = (email) => sendStaffOtp(email, ROLES.OFFICER);
const sendManagerOtp = (email) => sendStaffOtp(email, ROLES.MANAGER);

const verifyOfficerOtp = (email, otp_code) => verifyStaffOtp(email, otp_code, ROLES.OFFICER);
const verifyManagerOtp = (email, otp_code) => verifyStaffOtp(email, otp_code, ROLES.MANAGER);

// =========================================================================
// LOGIN (shared by all roles: student, officer, manager, admin, super_admin)
// =========================================================================

const login = async (email, password) => {

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  // Account was created by an Admin but the person hasn't completed
  // registration yet (no password set).
  if (!user.password_hash) {
    throw new Error("Please complete your registration first.");
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error("Invalid email or password.");
  }

  if (!user.is_active) {
    throw new Error("Your account has been deactivated. Please contact your administrator.");
  }

  return generateAuthResponse(user);
};

module.exports = {
  // student
  checkStudent,
  sendOtp,
  verifyOtp,
  registerStudent,
  // staff (generic, role passed explicitly)
  sendStaffOtp,
  verifyStaffOtp,
  registerStaff,
  // staff (role-bound convenience wrappers)
  registerOfficer,
  registerManager,
  sendOfficerOtp,
  sendManagerOtp,
  verifyOfficerOtp,
  verifyManagerOtp,
  // shared
  login,
};