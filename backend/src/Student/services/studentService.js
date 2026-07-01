const axios = require("axios");
const db = require("../../../models");
const {
  Complaint,
  Appeal,
  User,
  Student,
  Category,
  Faculty,
  ComplaintHistory,
  PriorityRules,
  sequelize,
} = db;

const PYTHON_SERVICE =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// Finds the "Other" category row for a given faculty
const getOtherCategory = async (facultyId) => {
  return Category.findOne({
    where: { is_other: true, faculty_id: facultyId, is_active: true },
  });
};

// 1. Submit complaint — handles "Other" category with auto-reroute
exports.submitNewComplaint = async (data) => {
  const t = await sequelize.transaction();

  try {
    const category = await Category.findByPk(data.category_id);
    if (!category) throw new Error("Category not found.");

    let finalCategoryId = data.category_id;
    let reroutedTo = null;

    // If student picked "Other", try to auto-reroute via the Python LLM service
    if (category.is_other) {
      try {
        const rerouteRes = await axios.post(
          `${PYTHON_SERVICE}/api/complaints/reroute`,
          {
            problem: data.problem,
            faculty_id: category.faculty_id,
          },
          { timeout: 10000 },
        );
        if (rerouteRes.data.rerouted && rerouteRes.data.category_id) {
          finalCategoryId = rerouteRes.data.category_id;
          reroutedTo = rerouteRes.data.category_name;
        }
      } catch (rerouteErr) {
        // If reroute fails for any reason, keep the "Other" category — never block submission
        console.warn(
          "Reroute call failed, keeping Other category:",
          rerouteErr.message,
        );
      }
    }

    const complaint = await Complaint.create(
      {
        user_id: data.user_id,
        category_id: finalCategoryId,
        problem: data.problem,
        location: data.location || null,
        since: data.since || null,
        ai_summary: data.ai_summary || "جاري التحليل...",
        priority: 3,
        status: "pending",
      },
      { transaction: t },
    );

    await ComplaintHistory.create(
      {
        complaint_id: complaint.id,
        status: "pending",
        changed_by: data.user_id,
        changed_at: new Date(),
      },
      { transaction: t },
    );

    await t.commit();

    return {
      success: true,
      complaint_id: complaint.id,
      priority: complaint.priority,
      rerouted: reroutedTo ? true : false,
      rerouted_to: reroutedTo,
    };
  } catch (error) {
    await t.rollback();
    console.error("Error in submitNewComplaint:", error);
    throw error;
  }
};

// 2. Get student complaints
exports.getStudentComplaints = async (user_id) => {
  return Complaint.findAll({
    where: { user_id },
    include: [{ model: Category, attributes: ["name", "is_other"] }],
    order: [["createdAt", "DESC"]],
  });
};

// 3. Get complaint details
exports.getComplaintById = async (id) => {
  return Complaint.findByPk(id, {
    include: [
      {
        model: User,
        attributes: ["full_name"],
        include: [
          {
            model: Student,
            attributes: ["department", "student_number"],
            include: [{ model: Faculty, attributes: ["name"] }],
          },
        ],
      },
      { model: Category, attributes: ["name", "sla_hours", "is_other"] },
      { model: Appeal },
      { model: ComplaintHistory },
    ],
    order: [[ComplaintHistory, "changed_at", "ASC"]],
  });
};

// 4. Create appeal
exports.createAppeal = async (complaintId, reason, userId) => {
  const t = await sequelize.transaction();

  try {
    await Appeal.create(
      {
        complaint_id: complaintId,
        reason,
        status: "pending",
      },
      { transaction: t },
    );

    await Complaint.update(
      { status: "appealed" },
      { where: { id: complaintId }, transaction: t },
    );

    await ComplaintHistory.create(
      {
        complaint_id: complaintId,
        status: "appealed",
        changed_by: userId,
        changed_at: new Date(),
      },
      { transaction: t },
    );

    await t.commit();
    return { success: true };
  } catch (error) {
    await t.rollback();
    console.error("Error in createAppeal:", error);
    throw error;
  }
};

// 5. Get active categories — includes is_other so frontend can identify the Other option
exports.getActiveCategories = async (facultyId) => {
  const where = { is_active: true };
  if (facultyId) where.faculty_id = facultyId;

  return Category.findAll({
    where,
    attributes: ["id", "name", "description", "sla_hours", "is_other"],
    order: [
      ["is_other", "ASC"],
      ["name", "ASC"],
    ],
  });
};
