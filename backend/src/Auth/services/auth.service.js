const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const { User, OtpToken, Faculty, University, sequelize, AdminRegistrationRequest } = require("../../../models");
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
    secure: false, // اجعليها true لو المنفذ 465
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

// ==================== 🛠️ الدوال المساعدة الناقصة (OTP & Crypto Helpers) ====================

// 1. توليد رمز OTP عشوائي من 6 أرقام
const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 2. تشفير الـ OTP لحفظه آمنًا في قاعدة البيانات
const hashOtp = async (otp_code) => {
  return await bcrypt.hash(otp_code, 8); // 8 جولات ملح كافية للرموز المؤقتة وسريعة
};

// 3. التحقق من مطابقة الـ OTP المبعوث بالـ Hash المحفوظ
const verifyOtpHash = async (otp_code, otp_hash) => {
  return await bcrypt.compare(otp_code, otp_hash);
};

// 4. إرسال الإيميل الفعلي للمستخدم باستخدام nodemailer
const sendOtpEmail = async (email, otp_code, expirySeconds) => {
  const transporter = createTransporter();
  const expiryMinutes = Math.ceil(expirySeconds / 60);

  const mailOptions = {
    from: `"⚙️ Complaint System Support" <${emailConfig.user}>`,
    to: email,
    subject: "Your Password Reset OTP Code",
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Use the code below to proceed:</p>
        <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f4f4f4; text-align: center; letter-spacing: 5px; color: #333;">
          ${otp_code}
        </div>
        <p style="color: #666; font-size: 14px;">This code is valid for <strong>${expiryMinutes} minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// ==================== Auth Tokens & Validations ====================

const generateAuthResponse = (user) => {
 const token = jwt.sign(
  { id: user.id, role: user.role, faculty_id: user.faculty_id ?? null },
  jwtConfig.secret,
  { expiresIn: jwtConfig.expiresIn }
);

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
// ADMIN REGISTRATION REQUEST
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
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await AdminRegistrationRequest.findOne({
    where: { email: normalizedEmail, status: "Pending" },
  });
 
  if (existing) {
    throw new Error(
      "A pending request already exists for this email. Please wait for review."
    );
  }
 
  const approvedDomain = await AdminRegistrationRequest.findOne({
    where: { email_domain, status: "Approved" },
  });
 
  if (approvedDomain) {
    throw new Error(
      "This faculty email domain is already registered in the system."
    );
  }
 
  const password_hash = await bcrypt.hash(password, 10);
 
  const request = await AdminRegistrationRequest.create({
    full_name,
    email: normalizedEmail,
    password_hash,
    university_name,
    faculty_name,
    email_domain,
    supporting_document,
    status: "Pending",
  });
 
  return {
    success: true,
    message: "Registration request submitted. You will be notified once reviewed.",
    request_id: request.id,
  };
};

// =========================================================================
// 1. FORGOT PASSWORD (طلب إعادة التعيين - إرسال OTP)
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
    const otp_code = generateOtpCode(); // 🎯 تم التوصيل بنجاح
    const otp_hash = await hashOtp(otp_code); // 🎯 تم التوصيل بنجاح
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

    await sendOtpEmail(normalizedEmail, otp_code, expirySeconds); // 🎯 تم التوصيل بنجاح

    return genericResponse;
};

// =========================================================================
// 2. RESET PASSWORD (تطبيق إعادة التعيين باستخدام الـ OTP)
// =========================================================================
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

    const isMatch = await verifyOtpHash(otp_code, otpRecord.otp_hash); // 🎯 تم التوصيل بنجاح

    if (!isMatch) {
        await otpRecord.increment("attempts");
        throw new Error("Invalid code.");
    }

    await otpRecord.update({ is_used: true });

    const user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) throw new Error("User no longer exists.");

    const password_hash = await hashPassword(new_password);
    await user.update({ password_hash });

    return { success: true, message: "Password reset successfully." };
};

// =========================================================================
// 3. CHANGE PASSWORD (تغيير كلمة المرور من داخل الحساب)
// =========================================================================
const changePassword = async (userId, currentPassword, newPassword) => {
    validatePassword(newPassword);

    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
        throw new Error("Your current password is incorrect.");
    }

    if (currentPassword === newPassword) {
        throw new Error("New password cannot be the same as the current password.");
    }

    const password_hash = await hashPassword(newPassword);
    await user.update({ password_hash });

    return { success: true, message: "Password changed successfully." };
};

// =========================================================================
// 4. LOGIN (تسجيل الدخول الموحد)
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

// ==================== Exports ====================
module.exports = {
    submitAdminRequest, 
    forgotPassword,
    resetPassword,
    changePassword, 
    login,
};