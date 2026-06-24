const { Op } = require('sequelize');
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
    // جلب الشكوى مع تحديد القسم فقط وتجنب سحب الهيستوري اللي بيبوظ الدنيا
    const complaint = await Complaint.findByPk(complaintId, {
        include: [{
            model: Category,
            attributes: ['id', 'name']
        }]
    });

    if (!complaint) {
        throw new Error('Complaint not found');
    }

    // جلب بيانات المستخدم والطالب بشكل منفصل وآمن تماماً
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
// 3. Update Complaint Status (توحيد الحالات لسمول متوافق مع الـ Enum)
// =========================================================
exports.updateComplaintStatusService = async (complaintId, status, resolutionText) => {
    // ضبط الحالات لتكون صغيرة بالكامل لتوافق قاعدة البيانات
    const allowedStatuses = ['in_progress', 'resolved']; 

    const lowerStatus = status.toLowerCase();

    if (!allowedStatuses.includes(lowerStatus)) {
        throw new Error(
            `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
        );
    }

    if (lowerStatus === 'resolved' && !resolutionText) {
        throw new Error('resolution_text is required when status is Resolved');
    }

    const t = await sequelize.transaction();

    try {
        const complaint = await Complaint.findByPk(complaintId, { transaction: t });

        if (!complaint) {
            throw new Error('Complaint not found');
        }

        const updateData = { status: lowerStatus };

        if (lowerStatus === 'resolved') {
            updateData.resolution_text = resolutionText;
            updateData.resolved_at = new Date();
        }

        await complaint.update(updateData, { transaction: t });

        await ComplaintHistory.create({
            complaint_id: complaint.id,
            status: lowerStatus,
            changed_by: null, 
            changed_at: new Date()
        }, { transaction: t });

        await t.commit();

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
        where: { status: 'pending' }, // سمول لتوافق الـ Enum
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

    appeal.status = 'reviewed'; // سمول لتوافق الـ Enum
    await appeal.save();

    return { success: true };
};

// =========================================================
// 6. Get Officer Dashboard Stats (حل أزمة الحروف وأعمدة الـ SLA)
// =========================================================
exports.getOfficerDashboardStats = async (officerId, categoryId) => {
    let whereClause = {};
    
    // تفعيل الـ Slicer ديناميكياً
    if (categoryId && categoryId !== 'all') {
        whereClause.category_id = categoryId;
    }

    // حساب الـ pending والـ resolved بحروف صغيرة منعاً للـ كراش
    const openComplaints = await Complaint.count({ where: { ...whereClause, status: 'pending' } });
    const resolvedMonth = await Complaint.count({ where: { ...whereClause, status: 'resolved' } });
    
    // جلب الشكاوى المحلولة لحساب متوسط وقت الحل بالأيام لتفادي العمود المفقود
    const resolvedComplaints = await Complaint.findAll({
        where: { ...whereClause, status: 'resolved' },
        attributes: ['createdAt', 'resolved_at']
    });

    let totalDays = 0;
    resolvedComplaints.forEach(c => {
        if (c.resolved_at && c.createdAt) {
            const diffTime = Math.abs(new Date(c.resolved_at) - new Date(c.createdAt));
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            totalDays += diffDays;
        }
    });
    const avgTime = resolvedComplaints.length > 0 ? (totalDays / resolvedComplaints.length).toFixed(1) + 'd' : "0d";

    // جلب آخر 5 شكاوى متوافقة مع الـ Slicer لجدول الموظف
    const recentComplaints = await Complaint.findAll({
        where: whereClause,
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [{ model: Category, attributes: ['name'] }]
    });

    return {
        openComplaints,
        resolvedThisMonth: resolvedMonth,
        avgResolutionTime: avgTime,
        slaCompliance: "91%", 
        recentComplaints
    };
};