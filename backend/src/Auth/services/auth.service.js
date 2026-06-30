const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const {
  User,
  OtpToken,
  Faculty,
  University,
  Student,
  AdminRegistrationRequest,
  sequelize,
} = require("../../../models");
const {
  jwt: jwtConfig,
  email: emailConfig,
} = require("../../../config/config");
const { ROLES } = require("../constants/roles");

// ==================== Constants ====================

const OTP_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

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

const getOtpExpirySeconds = () => {
  return parseInt(process.env.OTP_EXPIRY_SECONDS, 10) || 300;
};

const hashPassword = (password) => bcrypt.hash(password, 10);

// ==================== OTP Helpers ====================

const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = (otp) => bcrypt.hash(otp, 10);

const verifyOtpHash = (otp, hash) => bcrypt.compare(otp, hash);

const sendOtpEmail = async (email, otp_code, expirySeconds) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: emailConfig.user,
    to: email,
    subject: "Your verification code",
    text: `Your verification code is: ${otp_code}\nIt expires in ${Math.floor(expirySeconds / 60)} minutes.`,
  });
};

const generateAuthResponse = (user) => {
  const token = jwt.sign({ id: user.id, role: user.role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      name: user.full_name,
      role: user.role,
      is_also_manager: user.is_also_manager || false,
      officer_title: user.officer_title || null,
      manager_title: user.manager_title || null,
    },
  };
};

const validatePassword = (password) => {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
};

const checkCooldown = async (whereClause) => {
  const recentToken = await OtpToken.findOne({
    where: whereClause,
    order: [["createdAt", "DESC"]],
  });

  if (recentToken) {
    const secondsSinceLastRequest =
      (Date.now() - new Date(recentToken.createdAt).getTime()) / 1000;
    if (secondsSinceLastRequest < OTP_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(
        OTP_COOLDOWN_SECONDS - secondsSinceLastRequest,
      );
      throw new Error(
        `Please wait ${waitTime} seconds before requesting another OTP.`,
      );
    }
  }
};

// =========================================================================
// ADMIN REGISTRATION REQUEST -> approved by super admin -> then login
// Column is "university" not "university_name" — matches the actual table.
// =========================================================================

const submitAdminRequest = async ({
  full_name,
  email,
  password,
  university_name,
  faculty_name,
  email_domain,
  supporting_document,
}) => {
  if (
    !full_name ||
    !email ||
    !password ||
    !university_name ||
    !faculty_name ||
    !email_domain ||
    !supporting_document
  ) {
    throw new Error(
      "full_name, email, password, university_name, faculty_name, email_domain, and supporting_document are all required.",
    );
  }

  const existing = await AdminRegistrationRequest.findOne({
    where: { email, status: "Pending" },
  });

  if (existing) {
    throw new Error(
      "A pending request already exists for this email. Please wait for review.",
    );
  }

  const approvedDomain = await AdminRegistrationRequest.findOne({
    where: { email_domain, status: "Approved" },
  });

  if (approvedDomain) {
    throw new Error(
      "This faculty email domain is already registered in the system.",
    );
  }

  const password_hash = await bcrypt.hash(password, 10);

  const request = await AdminRegistrationRequest.create({
    full_name,
    email,
    password_hash,
    university_name,
    faculty_name,
    email_domain,
    supporting_document,
    status: "Pending",
  });

  return {
    success: true,
    message:
      "Registration request submitted. You will be notified once reviewed.",
    request_id: request.id,
  };
};

// =========================================================================
// SUPER ADMIN: review pending admin requests
// =========================================================================

const getPendingAdminRequests = async () => {
  return AdminRegistrationRequest.findAll({
    where: { status: "Pending" },
    order: [["createdAt", "ASC"]],
  });
};

const approveAdminRequest = async (requestId) => {
  const request = await AdminRegistrationRequest.findByPk(requestId);
  if (!request) throw new Error("Registration request not found.");
  if (request.status !== "Pending")
    throw new Error("This request has already been reviewed.");

  const existingUser = await User.findOne({ where: { email: request.email } });
  if (existingUser) {
    throw new Error("A user with this email already exists.");
  }

  // Find or create the faculty this admin will manage
  let faculty = await Faculty.findOne({
    where: { name: request.faculty_name },
  });
  if (!faculty) {
    let university = await University.findOne({
      where: { name: request.university_name },
    });
    if (!university) {
      university = await University.create({ name: request.university_name });
    }
    faculty = await Faculty.create({
      name: request.faculty_name,
      university_id: university.id,
      email_domain: request.email_domain,
    });
  }

  const user = await User.create({
    full_name: request.full_name,
    email: request.email,
    password_hash: request.password_hash,
    role: ROLES.ADMIN,
    is_active: true,
    faculty_id: faculty.id,
  });

  await request.update({ status: "Approved" });

  return {
    success: true,
    message: "Admin request approved.",
    user_id: user.id,
    faculty_id: faculty.id,
  };
};

const rejectAdminRequest = async (requestId, rejection_reason) => {
  const request = await AdminRegistrationRequest.findByPk(requestId);
  if (!request) throw new Error("Registration request not found.");
  if (request.status !== "Pending")
    throw new Error("This request has already been reviewed.");

  await request.update({
    status: "Rejected",
    rejection_reason: rejection_reason || null,
  });

  return { success: true, message: "Admin request rejected." };
};

// =========================================================================
// STUDENT REGISTRATION
// =========================================================================

const studentRequestOtp = async (student_number, email) => {
  const normalizedEmail = email.trim().toLowerCase();

  const student = await Student.findOne({
    where: { student_number: student_number.trim(), email: normalizedEmail },
  });

  if (!student) {
    throw new Error(
      "No student found with this student number and email combination. Please contact your faculty admin.",
    );
  }

  const existingUser = await User.findOne({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new Error("An account already exists for this email. Please log in.");
  }

  await checkCooldown({ email: normalizedEmail, purpose: "student_register" });

  const expirySeconds = getOtpExpirySeconds();
  const otp_code = generateOtpCode();
  const otp_hash = await hashOtp(otp_code);
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  await OtpToken.destroy({
    where: { email: normalizedEmail, purpose: "student_register" },
  });

  await OtpToken.create({
    email: normalizedEmail,
    purpose: "student_register",
    otp_hash,
    expires_at,
    is_used: false,
    attempts: 0,
  });

  await sendOtpEmail(normalizedEmail, otp_code, expirySeconds);

  return {
    success: true,
    message: "Verification code sent to your email.",
  };
};

const studentVerifyOtpAndRegister = async (
  student_number,
  email,
  otp_code,
  password,
) => {
  validatePassword(password);
  const normalizedEmail = email.trim().toLowerCase();

  const student = await Student.findOne({
    where: { student_number: student_number.trim(), email: normalizedEmail },
  });

  if (!student) {
    throw new Error("Student record not found.");
  }

  const existingUser = await User.findOne({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new Error("An account already exists for this email.");
  }

  const otpRecord = await OtpToken.findOne({
    where: {
      email: normalizedEmail,
      purpose: "student_register",
      is_used: false,
    },
    order: [["createdAt", "DESC"]],
  });

  if (!otpRecord) throw new Error("Invalid or expired code.");
  if (new Date() > otpRecord.expires_at) throw new Error("Code has expired.");
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS)
    throw new Error("Too many attempts. Please request a new code.");

  const isMatch = await verifyOtpHash(otp_code, otpRecord.otp_hash);
  if (!isMatch) {
    await otpRecord.increment("attempts");
    throw new Error("Invalid code.");
  }

  await otpRecord.update({ is_used: true });

  const password_hash = await hashPassword(password);

  const user = await User.create({
    full_name: student.full_name,
    email: normalizedEmail,
    password_hash,
    role: ROLES.STUDENT,
    is_active: true,
    faculty_id: student.faculty_id,
    student_id: student.id,
  });

  return generateAuthResponse(user);
};

// =========================================================================
// PASSWORD RESET (shared by all roles that already have an account)
// =========================================================================

const forgotPassword = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  const genericResponse = {
    success: true,
    message: "If this account exists, a reset code has been sent.",
  };

  if (!user || !user.password_hash) {
    return genericResponse;
  }

  await checkCooldown({ email: normalizedEmail, purpose: "password_reset" });

  const expirySeconds = getOtpExpirySeconds();
  const otp_code = generateOtpCode();
  const otp_hash = await hashOtp(otp_code);
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  await OtpToken.destroy({
    where: { email: normalizedEmail, purpose: "password_reset" },
  });

  await OtpToken.create({
    email: normalizedEmail,
    purpose: "password_reset",
    otp_hash,
    expires_at,
    is_used: false,
    attempts: 0,
  });

  await sendOtpEmail(normalizedEmail, otp_code, expirySeconds);

  return genericResponse;
};

const resetPassword = async (email, otp_code, new_password) => {
  validatePassword(new_password);
  const normalizedEmail = email.trim().toLowerCase();

  const otpRecord = await OtpToken.findOne({
    where: {
      email: normalizedEmail,
      purpose: "password_reset",
      is_used: false,
    },
    order: [["createdAt", "DESC"]],
  });

  if (!otpRecord) throw new Error("Invalid or expired code.");
  if (new Date() > otpRecord.expires_at) throw new Error("Code has expired.");
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS)
    throw new Error("Too many attempts. Please request a new code.");

  const isMatch = await verifyOtpHash(otp_code, otpRecord.otp_hash);

  if (!isMatch) {
    await otpRecord.increment("attempts");
    throw new Error("Invalid code.");
  }

  await otpRecord.update({ is_used: true });

  const user = await User.findOne({ where: { email: normalizedEmail } });
  const password_hash = await hashPassword(new_password);
  await user.update({ password_hash });

  return { success: true, message: "Password reset successfully." };
};

// =========================================================================
// LOGIN (shared by all roles)
// =========================================================================

const login = async (email, password) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error("Invalid email or password.");
  }

  if (!user.is_active) {
    throw new Error(
      "Your account has been deactivated. Please contact your administrator.",
    );
  }

  return generateAuthResponse(user);
};

module.exports = {
  // admin
  submitAdminRequest,
  getPendingAdminRequests,
  approveAdminRequest,
  rejectAdminRequest,
  // student
  studentRequestOtp,
  studentVerifyOtpAndRegister,
  // password reset
  forgotPassword,
  resetPassword,
  // login
  login,
};
