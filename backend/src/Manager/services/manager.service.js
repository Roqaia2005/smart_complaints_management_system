const { Op } = require('sequelize');

const db = require('../../../models');

const { Complaint, Category,
    Appeal,
    AiRecommendation,
    AnalysisReport,
    sequelize } = db;
// في manager.service.js مؤقتاً

exports.overviewService = async (userId, fromDate) => {

    const complaintWhere = {};

    // optional createdAt filter
    if (fromDate) {
        complaintWhere.createdAt = {
            [Op.gte]: fromDate
        };
    }

    const [
        total,
        pending,
        resolved,
        inProgress,
        appealed
    ] = await Promise.all([

        Complaint.count({
            where: complaintWhere
        }),

        Complaint.count({
            where: {
                ...complaintWhere,
                status: 'pending'
            }
        }),

        Complaint.count({
            where: {
                ...complaintWhere,
                status: 'resolved'
            }
        }),

        Complaint.count({
            where: {
                ...complaintWhere,
                status: 'in_progress'
            }
        }),

        Appeal.count()
    ]);

    return {
        total,
        pending,
        resolved,
        inProgress,
        appealed
    };
};

// =========================================================
exports.departmentPerformanceService = async () => {
 
    const results = await sequelize.query(`
        SELECT
            s.department AS name,
            COUNT(comp.id) AS total,
            COUNT(comp.id) FILTER (WHERE comp.status = 'resolved') AS resolved,
            AVG(
                EXTRACT(EPOCH FROM (comp.resolved_at - comp."createdAt")) / 3600.0
            ) FILTER (WHERE comp.status = 'resolved') AS avg_hours
        FROM "Complaints" comp
        JOIN users u ON u.id = comp.user_id
        JOIN "Students" s ON s.id = u.student_id
        WHERE s.department IS NOT NULL
        GROUP BY s.department
        ORDER BY s.department ASC
    `, { type: sequelize.QueryTypes.SELECT });
 
    const departments = results.map(row => ({
        name: row.name,
        total: parseInt(row.total, 10) || 0,
        resolved: parseInt(row.resolved, 10) || 0,
        avg_hours: row.avg_hours !== null
            ? parseFloat(parseFloat(row.avg_hours).toFixed(1))
            : 0
    }));
 
    return { departments };
};
 
// =========================================================
// 2. Heatmap Data
// =========================================================
exports.heatmapService = async (dimension) => {
 
    let results;
 
    switch (dimension) {
 
        case 'category':
            results = await sequelize.query(`
                SELECT c.name AS label, COUNT(comp.id) AS count
                FROM categories c
                LEFT JOIN "Complaints" comp ON comp.category_id = c.id
                GROUP BY c.name
                ORDER BY count DESC
            `, { type: sequelize.QueryTypes.SELECT });
            break;
 
        case 'location':
            results = await sequelize.query(`
                SELECT location AS label, COUNT(id) AS count
                FROM "Complaints"
                WHERE location IS NOT NULL
                GROUP BY location
                ORDER BY count DESC
            `, { type: sequelize.QueryTypes.SELECT });
            break;
 
        case 'time':
            results = await sequelize.query(`
                SELECT
                    TO_CHAR("createdAt", 'YYYY-MM') AS label,
                    COUNT(id) AS count
                FROM "Complaints"
                GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
                ORDER BY label ASC
            `, { type: sequelize.QueryTypes.SELECT });
            break;
 
        case 'department':
            results = await sequelize.query(`
                SELECT s.department AS label, COUNT(comp.id) AS count
                FROM "Complaints" comp
                JOIN users u ON u.id = comp.user_id
                JOIN "Students" s ON s.id = u.student_id
                WHERE s.department IS NOT NULL
                GROUP BY s.department
                ORDER BY count DESC
            `, { type: sequelize.QueryTypes.SELECT });
            break;
 
        default:
            throw new Error(
                'Invalid dimension. Use: category, location, time, or department'
            );
    }
 
    const heatmap = results.map(row => ({
        label: row.label,
        count: parseInt(row.count, 10) || 0
    }));
 
    return { heatmap };
};
 
// =========================================================
// 3. AI Recommendations - list all
// =========================================================
exports.getRecommendationsService = async () => {
 
    const recommendations = await AiRecommendation.findAll({
        include: [{
            model: Category,
            attributes: ['name']
        }],
        order: [['createdAt', 'DESC']]
    });
 
    const formatted = recommendations.map(r => ({
        id: r.id,
        category: r.Category ? r.Category.name : null,
        pattern: r.pattern_detected,
        recommendation: r.recommendation,
        status: r.status,
        root_cause: r.root_cause,
        urgency: r.urgency,
        estimated_impact: r.estimated_impact,
        location: r.location,
        complaint_count: r.complaint_count,
        avg_resolution_h: r.avg_resolution_h,
        appeal_rate_pct: r.appeal_rate_pct,
        top_keywords: r.top_keywords,
        generated_at: r.generated_at
    }));
 
    return { recommendations: formatted };
};
 
// =========================================================
// 4. Update Recommendation Status
// =========================================================
exports.updateRecommendationStatusService = async (id, status) => {
 
    const allowedStatuses = ['pending', 'implemented', 'ignored'];
 
    if (!allowedStatuses.includes(status)) {
        throw new Error(
            `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
        );
    }
 
    const recommendation = await AiRecommendation.findByPk(id);
 
    if (!recommendation) {
        throw new Error('Recommendation not found');
    }
 
    recommendation.status = status;
    await recommendation.save();
 
    return { success: true };
};
 
// =========================================================
// 5. Reports (filtered complaints)
// =========================================================
exports.reportsService = async (filters) => {
 
    const { from, to, category_id, status } = filters;
 
    const where = {};
 
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from);
        if (to) where.createdAt[Op.lte] = new Date(to);
    }
 
    if (category_id) {
        where.category_id = category_id;
    }
 
    if (status) {
        where.status = status;
    }
 
    const { count, rows } = await Complaint.findAndCountAll({
        where,
        include: [{
            model: Category,
            attributes: ['id', 'name']
        }],
        order: [['createdAt', 'DESC']]
    });
 
    return {
        complaints: rows,
        total_count: count
    };
};
 
// =========================================================
// 6. Top Issues per Category
// =========================================================
exports.topIssuesService = async (categoryId) => {
 
    const report = await AnalysisReport.findOne({
        where: { category_id: categoryId },
        order: [['generated_at', 'DESC']]
    });
 
    if (!report) {
        return { top_issues: [] };
    }
 
    return { top_issues: report.top_issues || [] };
};
