const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
// بعد
const { Student, User, OtpToken, Faculty, University, sequelize } = require("../../../models");
const {
  jwt: jwtConfig,
  email: emailConfig,
} = require("../../../config/config");
const { ROLES, STAFF_SIGNUP_ROLES } = require("../constants/roles");
const { isEmailAllowed } = require("../helpers/emailDomain");

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

const getOtpExpiry = () => {
    return parseInt(process.env.OTP_EXPIRY_SECONDS, 10) || 300;
};



const hashPassword = (password) => bcrypt.hash(password, 10);

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

const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = (otp_code) => bcrypt.hash(otp_code, 10);

const verifyOtpHash = (otp_code, hash) => bcrypt.compare(otp_code, hash);

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

// Shared cooldown check - prevents spamming OTP requests for the same identifier
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

  const existingUser = await User.findOne({
    where: { student_id: student.id },
  });
  if (existingUser)
    throw new Error("This student already has an account. Please log in.");

  await checkCooldown({ student_number });

  const expirySeconds = await getOtpExpirySeconds();
  const otp_code = generateOtpCode();
  const otp_hash = await hashOtp(otp_code);
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  await OtpToken.destroy({ where: { student_number } });

  await OtpToken.create({
    student_number,
    otp_hash,
    purpose: "student_signup",
    expires_at,
    is_used: false,
    attempts: 0,
  });

  await sendOtpEmail(student.email, otp_code, expirySeconds);

  return { success: true, message: "OTP sent to your university email" };
};

// ==================== Verify OTP (Student) ====================

const verifyOtp = async (student_number, otp_code) => {
  const otpRecord = await OtpToken.findOne({
    where: { student_number, purpose: "student_signup", is_used: false },
    order: [["createdAt", "DESC"]],
  });

  if (!otpRecord) throw new Error("Invalid OTP.");
  if (new Date() > otpRecord.expires_at) throw new Error("OTP has expired.");

  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many incorrect attempts. Please request a new OTP.");
  }

  const isMatch = await verifyOtpHash(otp_code, otpRecord.otp_hash);

  if (!isMatch) {
    await otpRecord.increment("attempts");
    throw new Error("Invalid OTP.");
  }

  await otpRecord.update({ is_used: true });

  return { success: true };
};

// ==================== Register Student ====================

const registerStudent = async (student_number, password) => {
  validatePassword(password);

  const student = await Student.findOne({ where: { student_number } });
  if (!student) throw new Error("Student not found.");

  const existingUser = await User.findOne({
    where: { student_id: student.id },
  });
  if (existingUser) throw new Error("Account already exists. Please log in.");

  const usedOtp = await OtpToken.findOne({
    where: { student_number, purpose: "student_signup", is_used: true },
    order: [["createdAt", "DESC"]],
  });
  if (!usedOtp)
    throw new Error("OTP verification required before registration.");

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
 
    // find the user first to get their faculty
    const user = await User.findOne({
        where: { email: normalizedEmail, role },
        include: [{
            model: Faculty,
            attributes: ['email_domain']
        }]
    });
 
    if (!user) {
        throw new Error("This email was not found. Please contact your administrator.");
    }
 
    if (user.password_hash) {
        throw new Error("This account is already registered. Please log in.");
    }
 
    // validate email domain against the faculty's configured domain
    if (user.Faculty && user.Faculty.email_domain) {
        if (!isEmailAllowed(normalizedEmail, user.Faculty.email_domain)) {
            throw new Error(
                `Email must use the configured university domain (@${user.Faculty.email_domain}).`
            );
        }
    }

  await checkCooldown({ email: normalizedEmail, signup_role: role });

  const expirySeconds = await getOtpExpiry();
  const otp_code = generateOtpCode();
  const otp_hash = await hashOtp(otp_code);
  const expires_at = new Date(Date.now() + expirySeconds * 1000);

  await OtpToken.destroy({
    where: { email: normalizedEmail, signup_role: role },
  });

  await OtpToken.create({
    email: normalizedEmail,
    signup_role: role,
    purpose: "staff_signup",
    otp_hash,
    expires_at,
    is_used: false,
    attempts: 0,
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
    where: {
      email: normalizedEmail,
      signup_role: role,
      purpose: "staff_signup",
      is_used: false,
    },
    order: [["createdAt", "DESC"]],
  });

  if (!otpRecord) throw new Error("Invalid OTP.");
  if (new Date() > otpRecord.expires_at) throw new Error("OTP has expired.");

  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many incorrect attempts. Please request a new OTP.");
  }

  const isMatch = await verifyOtpHash(otp_code, otpRecord.otp_hash);

  if (!isMatch) {
    await otpRecord.increment("attempts");
    throw new Error("Invalid OTP.");
  }

  await otpRecord.update({ is_used: true });

  return { success: true };
};

// ==================== Register Staff (Officer / Manager) ====================

const registerAdmin = async (data) => {
    const {
        full_name,
        email,
        password,
        university_name,
        faculty_name,
        email_domain
    } = data;
 
    // validations
    if (!full_name || !email || !password || !university_name || !faculty_name || !email_domain) {
        throw new Error("All fields are required: full_name, email, password, university_name, faculty_name, email_domain.");
    }
 
    validatePassword(password);
 
    const normalizedEmail = email.trim().toLowerCase();
 
    // check email not already taken
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
        throw new Error("An account with this email already exists.");
    }
 
    const t = await require('../../../models').sequelize.transaction();
 
    try {
        // 1. Create University
        const university = await University.create(
            { name: university_name.trim() },
            { transaction: t }
        );
 
        // 2. Create Faculty linked to that University
        const faculty = await Faculty.create(
            {
                name: faculty_name.trim(),
                email_domain: email_domain.trim().toLowerCase(),
                university_id: university.id
            },
            { transaction: t }
        );
 
        // 3. Create Admin user (inactive until super_admin approves)
        const password_hash = await hashPassword(password);
 
        const admin = await User.create(
            {
                full_name: full_name.trim(),
                email: normalizedEmail,
                password_hash,
                role: ROLES.ADMIN,
                is_active: false,   // pending super_admin approval
                faculty_id: faculty.id
            },
            { transaction: t }
        );
 
        await t.commit();
 
        return {
            success: true,
            message: "Registration submitted. Your account is pending super admin approval.",
            user: {
                id: admin.id,
                name: admin.full_name,
                role: admin.role,
                university: university.name,
                faculty: faculty.name
            }
        };
 
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const registerStaff = async (email, password, role) => {
  if (!STAFF_SIGNUP_ROLES.includes(role)) {
    throw new Error("Invalid role for staff signup.");
  }

  validatePassword(password);

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    where: { email: normalizedEmail, role },
  });

  if (!user) {
    throw new Error(
      "This email was not found. Please contact your administrator.",
    );
  }

  if (user.password_hash) {
    throw new Error("This account is already registered. Please log in.");
  }

  const usedOtp = await OtpToken.findOne({
    where: {
      email: normalizedEmail,
      signup_role: role,
      purpose: "staff_signup",
      is_used: true,
    },
    order: [["createdAt", "DESC"]],
  });

  if (!usedOtp) {
    throw new Error("OTP verification required before registration.");
  }

  const password_hash = await hashPassword(password);

  await user.update({
    password_hash,
    is_active: true,
  });

  return generateAuthResponse(user);
};

const registerOfficer = (email, password) =>
  registerStaff(email, password, ROLES.OFFICER);

const registerManager = (email, password) =>
  registerStaff(email, password, ROLES.MANAGER);

const sendOfficerOtp = (email) => sendStaffOtp(email, ROLES.OFFICER);
const sendManagerOtp = (email) => sendStaffOtp(email, ROLES.MANAGER);

const verifyOfficerOtp = (email, otp_code) =>
  verifyStaffOtp(email, otp_code, ROLES.OFFICER);
const verifyManagerOtp = (email, otp_code) =>
  verifyStaffOtp(email, otp_code, ROLES.MANAGER);

// =========================================================================
// PASSWORD RESET (shared by all roles that already have an account)
// =========================================================================

const forgotPassword = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  // Always return the same message whether or not the account exists -
  // prevents using this endpoint to discover valid student/staff emails.
  const genericResponse = {
    success: true,
    message: "If this account exists, a reset code has been sent.",
  };

  if (!user || !user.password_hash) {
    return genericResponse;
  }

  await checkCooldown({ email: normalizedEmail, purpose: "password_reset" });

  const expirySeconds = await getOtpExpirySeconds();
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
    throw new Error(
      "Your account has been deactivated. Please contact your administrator.",
    );
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
  registerAdmin,
  registerManager,
  sendOfficerOtp,
  sendManagerOtp,
  verifyOfficerOtp,
  verifyManagerOtp,
  // password reset
  forgotPassword,
  resetPassword,
  // shared
  login,
};
