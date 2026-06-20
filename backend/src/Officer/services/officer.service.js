const db = require('../../../models');
const {
    Complaint,
    Category,
    Appeal,
    User,
    Student,
    ComplaintHistory,
    sequelize
} = db;

// =========================================================
// 1. Get Department (Category) Complaints
// Ordered by AI priority highest first
// =========================================================
exports.getDepartmentComplaintsService = async (categoryId) => {

    const results = await sequelize.query(`
        SELECT
            comp.id,
            comp.problem,
            comp.ai_summary,
            comp.priority,
            comp.status,
            s.full_name AS student_name,
            comp."createdAt" AS created_at
        FROM "Complaints" comp
        JOIN users u ON u.id = comp.user_id
        LEFT JOIN "Students" s ON s.id = u.student_id
        WHERE comp.category_id = :categoryId
        ORDER BY comp.priority DESC, comp."createdAt" DESC
    `, {
        replacements: { categoryId },
        type: sequelize.QueryTypes.SELECT
    });

    return { complaints: results };
};

// =========================================================
// 2. Get Complaint Details (with student info)
// =========================================================
exports.getComplaintDetailsService = async (complaintId) => {

    const complaint = await Complaint.findByPk(complaintId, {
        include: [{
            model: Category,
            attributes: ['id', 'name']
        }]
    });

    if (!complaint) {
        throw new Error('Complaint not found');
    }

    const user = await User.findByPk(complaint.user_id, {
        include: [{
            model: Student
        }]
    });

    const student = user && user.Student
        ? {
            name: user.Student.full_name,
            department: user.Student.department,
            academic_year: user.Student.academic_year
        }
        : null;

    return {
        complaint,
        student
    };
};

// =========================================================
// 3. Update Complaint Status
// =========================================================
exports.updateComplaintStatusService = async (complaintId, status, resolutionText) => {

    const allowedStatuses = ['in_progress', 'resolved'];

    if (!allowedStatuses.includes(status)) {
        throw new Error(
            `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
        );
    }

    if (status === 'resolved' && !resolutionText) {
        throw new Error('resolution_text is required when status is resolved');
    }

    const t = await sequelize.transaction();

    try {
        const complaint = await Complaint.findByPk(complaintId, { transaction: t });

        if (!complaint) {
            throw new Error('Complaint not found');
        }

        const updateData = { status };

        if (status === 'resolved') {
            updateData.resolution_text = resolutionText;
            updateData.resolved_at = new Date();
        }

        await complaint.update(updateData, { transaction: t });

        await ComplaintHistory.create({
            complaint_id: complaint.id,
            status,
            changed_by: null, // TODO: set to officer's user_id once auth is added
            changed_at: new Date()
        }, { transaction: t });

        await t.commit();

        // TODO: if status === 'resolved', call Python service
        // to add resolution_text to ChromaDB for this complaint.
        // e.g. await addResolutionToChromaDB(complaint.id, resolutionText);

        return { success: true };

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// =========================================================
// 4. Get Appealed Complaints (in officer's category)
// =========================================================
exports.getAppealedComplaintsService = async (categoryId) => {

    const appeals = await Appeal.findAll({
        where: { status: 'pending' },
        include: [{
            model: Complaint,
            where: { category_id: categoryId },
            required: true
        }]
    });

    const formatted = appeals.map(a => ({
        appeal_id: a.id,
        complaint: a.Complaint,
        appeal_reason: a.reason,
        appeal_date: a.createdAt
    }));

    return { appeals: formatted };
};

// =========================================================
// 5. Mark Appeal as Reviewed
// =========================================================
exports.markAppealReviewedService = async (appealId) => {

    const appeal = await Appeal.findByPk(appealId);

    if (!appeal) {
        throw new Error('Appeal not found');
    }

    appeal.status = 'reviewed';
    await appeal.save();

    return { success: true };
};