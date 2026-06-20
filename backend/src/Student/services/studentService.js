const axios = require('axios');

const db = require('../../../models');

const {
    Complaint,
    Appeal,
    User,
    Student,
    Category,
    Faculty,
    ComplaintHistory,
    PriorityRules,
    sequelize
} = db;

// 1. submit complaint
exports.submitNewComplaint = async (data) => {

    const t = await sequelize.transaction();

    try {

        const rules = await PriorityRules.findAll();

        // AI disabled temporarily
        const priorityFromAI = 3;

        const complaint = await Complaint.create({
            user_id: data.user_id,
            category_id: data.category_id,
            problem: data.problem,
            location: data.location,
            since: data.since,
            ai_summary: data.ai_summary || 'جاري التحليل...',
            priority: priorityFromAI,
            status: 'pending'
        }, { transaction: t });

        await ComplaintHistory.create({
            complaint_id: complaint.id,
            status: 'pending',
            changed_by: data.user_id,
            changed_at: new Date()
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            complaint_id: complaint.id,
            priority: complaint.priority
        };

    } catch (error) {

        await t.rollback();

        console.error('Error in submitNewComplaint:', error);

        throw error;
    }
};

// 2. get student complaints
exports.getStudentComplaints = async (user_id) => {

    return await Complaint.findAll({
        where: { user_id },

        include: [
            {
                model: Category,
                attributes: ['name']
            }
        ],

        order: [['createdAt', 'DESC']]
    });
};

// 3. get complaint details
exports.getComplaintById = async (id) => {

    return await Complaint.findByPk(id, {

        include: [

            {
                model: User,
                attributes: ['full_name'],
                include: [
                    {
                        model: Student,
                        attributes: ['department', 'student_number'],
                        include: [
                            {
                                model: Faculty,
                                attributes: ['name']
                            }
                        ]
                    }
                ]
            },

            {
                model: Category,
                attributes: ['name', 'sla_hours']
            },

            {
                model: Appeal
            },

            {
                model: ComplaintHistory
            }
        ],

        order: [
            [ComplaintHistory, 'changed_at', 'ASC']
        ]
    });
};

// 4. create appeal
exports.createAppeal = async (complaintId, reason, userId) => {

    const t = await sequelize.transaction();

    try {

        await Appeal.create({
            complaint_id: complaintId,
            reason,
            status: 'pending'
        }, { transaction: t });

        await Complaint.update(
            { status: 'appealed' },
            {
                where: { id: complaintId },
                transaction: t
            }
        );

        await ComplaintHistory.create({
            complaint_id: complaintId,
            status: 'appealed',
            changed_by: userId,
            changed_at: new Date()
        }, { transaction: t });

        await t.commit();

        return { success: true };

    } catch (error) {

        await t.rollback();

        console.error('Error in createAppeal:', error);

        throw error;
    }
};