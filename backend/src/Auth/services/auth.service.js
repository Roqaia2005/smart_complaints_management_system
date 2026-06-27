const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const { User, OtpToken, Faculty, University, sequelize } = require("../../../models");
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

// Shared cooldown check
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
// =========================================================================

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
  forgotPassword,
  resetPassword,
  login,
};