const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { User, Faculty, University, AdminRegistrationRequest } = require("../../../models");
const { email: emailConfig } = require("../../../config/config");

// ==================== Email Helper ====================

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: { user: emailConfig.user, pass: emailConfig.pass },
    });
    await transporter.sendMail({
      from: `"University Complaints System" <${emailConfig.user}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    // مش هنوقف العملية لو الإيميل فشل
    console.error("Email send failed:", err.message);
  }
};

// ==================== Get All Requests ====================

const getAllRequests = async () => {
  return await AdminRegistrationRequest.findAll({
    order: [["createdAt", "DESC"]],
    attributes: { exclude: ["password_hash"] },
  });
};

// ==================== Get Pending Requests ====================

const getPendingRequests = async () => {
  return await AdminRegistrationRequest.findAll({
    where: { status: "Pending" },
    order: [["createdAt", "ASC"]],
    attributes: { exclude: ["password_hash"] },
  });
};

// ==================== Get Single Request ====================

const getRequestById = async (id) => {
  const request = await AdminRegistrationRequest.findByPk(id, {
    attributes: { exclude: ["password_hash"] },
  });
  if (!request) throw new Error("Request not found.");
  return request;
};

// ==================== Approve Request ====================

const approveRequest = async (id) => {
  const request = await AdminRegistrationRequest.findByPk(id);
  if (!request) throw new Error("Request not found.");

  if (request.status !== "Pending") {
    throw new Error(`Request is already ${request.status}.`);
  }

  // تأكد مش فيه admin بنفس الـ email موجود
  const existingUser = await User.findOne({ where: { email: request.email } });
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  // تأكد مش فيه faculty بنفس الـ email_domain موجودة
  const existingFaculty = await Faculty.findOne({
    where: { email_domain: request.email_domain },
  });
  if (existingFaculty) {
    throw new Error("This faculty email domain is already registered.");
  }

  // 1. دور على الجامعة، لو مش موجودة اعملها
  let university = await University.findOne({
    where: { name: request.university_name },
  });
  if (!university) {
    university = await University.create({ name: request.university_name });
  }

  // 2. اعمل الكلية
  const faculty = await Faculty.create({
    name: request.faculty_name,
    email_domain: request.email_domain,
    university_id: university.id,
  });

  // 3. اعمل حساب الأدمن (الباسورد موجود بالفعل في الـ request)
  const admin = await User.create({
    full_name: request.full_name,
    email: request.email,
    password_hash: request.password_hash,
    role: "admin",
    faculty_id: faculty.id,
    is_active: true,
  });

  // 4. حدّث الـ request
  await request.update({ status: "Approved" });

  // 5. ابعت email للأدمن
  await sendEmail(
    request.email,
    "Your registration has been approved ✅",
    `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Welcome, ${request.full_name}!</h2>
      <p>Your registration request for <strong>${request.faculty_name}</strong> has been approved.</p>
      <p>You can now log in using your email and password.</p>
      <p style="color: #6b6b6b; font-size: 13px;">If you have any issues, please contact support.</p>
    </div>
    `
  );

  return {
    success: true,
    admin_id: admin.id,
    faculty_id: faculty.id,
    university_id: university.id,
  };
};

// ==================== Reject Request ====================

const rejectRequest = async (id, rejection_reason) => {
  const request = await AdminRegistrationRequest.findByPk(id);
  if (!request) throw new Error("Request not found.");

  if (request.status !== "Pending") {
    throw new Error(`Request is already ${request.status}.`);
  }

  if (!rejection_reason) {
    throw new Error("rejection_reason is required.");
  }

  await request.update({ status: "Rejected", rejection_reason });

  // ابعت email للأدمن بسبب الرفض
  await sendEmail(
    request.email,
    "Your registration request has been reviewed",
    `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Registration Request Update</h2>
      <p>Dear ${request.full_name},</p>
      <p>Unfortunately, your registration request for <strong>${request.faculty_name}</strong> has not been approved.</p>
      <p><strong>Reason:</strong> ${rejection_reason}</p>
      <p>If you believe this is an error, please contact support.</p>
    </div>
    `
  );

  return { success: true };
};

// ==================== Get All Admins (approved users) ====================

const getAllAdmins = async () => {
  return await User.findAll({
    where: { role: "admin" },
    attributes: ["id", "full_name", "email", "is_active", "faculty_id", "createdAt"],
    include: [
      {
        model: Faculty,
        attributes: ["id", "name", "email_domain"],
        include: [{ model: University, attributes: ["id", "name"] }],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
};

const deleteAdmin = async (id) => {
  const admin = await User.findOne({ where: { id, role: "admin" } });
  if (!admin) throw new Error("Admin not found.");
  await admin.update({ is_active: false });
};

module.exports = {
  getAllRequests,
  getPendingRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  getAllAdmins,
  deleteAdmin,
};