const { User, Faculty, University } = require("../../../models");

// ==================== Get All Admins (approved + pending) ====================

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

// ==================== Get Pending Admins Only ====================

const getPendingAdmins = async () => {
  return await User.findAll({
    where: { role: "admin", is_active: false },
    attributes: ["id", "full_name", "email", "faculty_id", "createdAt"],
    include: [
      {
        model: Faculty,
        attributes: ["id", "name", "email_domain"],
        include: [{ model: University, attributes: ["id", "name"] }],
      },
    ],
    order: [["createdAt", "ASC"]],
  });
};

// ==================== Get Single Admin ====================

const getAdminById = async (id) => {
  const admin = await User.findOne({
    where: { id, role: "admin" },
    attributes: ["id", "full_name", "email", "is_active", "faculty_id", "createdAt"],
    include: [
      {
        model: Faculty,
        attributes: ["id", "name", "email_domain"],
        include: [{ model: University, attributes: ["id", "name"] }],
      },
    ],
  });

  if (!admin) throw new Error("Admin not found.");
  return admin;
};

// ==================== Approve Admin ====================

const approveAdmin = async (id) => {
  const admin = await User.findOne({
    where: { id, role: "admin" },
    include: [{ model: Faculty }],
  });
  if (!admin) throw new Error("Admin not found.");

  if (admin.is_active) throw new Error("Admin is already approved.");

  // تأكد إن مفيش أدمن approved تاني لنفس الكلية (منع التكرار)
  const existingApprovedAdmin = await User.findOne({
    where: {
      role: "admin",
      faculty_id: admin.faculty_id,
      is_active: true,
    },
  });

  if (existingApprovedAdmin) {
    throw new Error(
      "This faculty already has an approved admin. Reject this request or contact support."
    );
  }

  await admin.update({ is_active: true });
  return admin;
};

// ==================== Reject Admin ====================

const rejectAdmin = async (id) => {
  const admin = await User.findOne({ where: { id, role: "admin" } });
  if (!admin) throw new Error("Admin not found.");

  if (admin.is_active) throw new Error("Cannot reject an already approved admin. Use delete instead.");

  // بنمسح حساب الأدمن المرفوض + الكلية المرتبطة بيه (كانت اتعملت وقت الـ signup)
  const facultyId = admin.faculty_id;

  await admin.destroy();

  if (facultyId) {
    const otherAdminsUsingFaculty = await User.findOne({ where: { faculty_id: facultyId } });
    if (!otherAdminsUsingFaculty) {
      await Faculty.destroy({ where: { id: facultyId } });
    }
  }

  return { success: true };
};

// ==================== Delete Admin (Soft Delete, for already-approved admins) ====================

const deleteAdmin = async (id) => {
  const admin = await User.findOne({ where: { id, role: "admin" } });
  if (!admin) throw new Error("Admin not found.");

  await admin.update({ is_active: false });
};

module.exports = {
  getAllAdmins,
  getPendingAdmins,
  getAdminById,
  approveAdmin,
  rejectAdmin,
  deleteAdmin,
};