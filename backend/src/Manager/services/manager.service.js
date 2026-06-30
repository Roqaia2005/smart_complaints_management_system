const { Op, fn, col } = require('sequelize');
const db = require('../../../models');

const { 
    Complaint, 
    Category,
    Appeal,
    User,
    sequelize 
} = db;

// 💡 دالة مساعدة: بتجيب الـ IDs بتاعة الـ Categories التابعة لكلية الـ Manager ده بس
// ملحوظة: افترضنا هنا إن الـ Manager مربوط بـ faculty_id في جدول الـ Users، والـ Categories فيها faculty_id
const getManagerCategoryIds = async (managerId) => {
    const manager = await User.findByPk(managerId, { attributes: ['faculty_id'] });
    if (!manager || !manager.faculty_id) return [];

    const categories = await Category.findAll({
        where: { faculty_id: manager.faculty_id },
        attributes: ['id']
    });
    return categories.map(c => c.id);
};

// =========================================================
// 1. Get Manager Dashboard Stats (Isolation كامل)
// =========================================================
exports.getManagerDashboardStats = async (managerId, categoryId = null) => {
    const allowedCategoryIds = await getManagerCategoryIds(managerId);

    // لو المنيجر ملوش كلية أو كلية ملهاش أقسام، اقطع الداتا فوراً (Isolation)
    if (allowedCategoryIds.length === 0) {
        return { totalComplaints: 0, resolutionRate: '0%', slaBreachRate: '0%', appealRate: '0%', statusBreakdown: { pending: 0, in_progress: 0, resolved: 0, appealed: 0 }, officerPerformance: [] };
    }

    // بناء الشرط الأساسي للعزل: لازم الداتا تكون تبع فئات كليته فقط
    let filterWhere = {
        category_id: { [Op.in]: allowedCategoryIds }
    };

    if (categoryId && categoryId !== 'all') {
        if (allowedCategoryIds.includes(parseInt(categoryId))) {
            filterWhere.category_id = parseInt(categoryId);
        } else {
            throw new Error('Unauthorized category selection.');
        }
    }

    // 1. إجمالي الشكاوى
    const totalComplaints = await Complaint.count({ where: filterWhere });

    // 2. توزيع الحالات (Status Breakdown)
    const statusCounts = await Complaint.findAll({
        where: filterWhere,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status']
    });

    let statusBreakdown = { pending: 0, in_progress: 0, resolved: 0, appealed: 0 };
    let totalResolved = 0;
    let totalAppealed = 0;

    statusCounts.forEach(item => {
        let status = item.dataValues.status;
        const count = parseInt(item.dataValues.count, 10);
        
        if (status) {
            status = status.toLowerCase();
            if (status === 'resolved') totalResolved = count;
            if (status === 'appealed') totalAppealed = count;
        }

        if (statusBreakdown.hasOwnProperty(status)) {
            statusBreakdown[status] = totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0;
        }
    });

    const resolutionRate = totalComplaints > 0 ? Math.round((totalResolved / totalComplaints) * 100) + '%' : '0%';
    const appealRate = totalComplaints > 0 ? Math.round((totalAppealed / totalComplaints) * 100) + '%' : '0%';

    // حساب الـ SLA Breach
    const breachedCount = await Complaint.count({
        where: {
            ...filterWhere,
            sla_deadline: { [Op.lt]: sequelize.col('resolved_at') }
        }
    });
    const slaBreachRate = totalComplaints > 0 ? Math.round((breachedCount / totalComplaints) * 100) + '%' : '0%';

    // 4. أداء الموظفين الحقيقي التابعين لكليته فقط
    const manager = await User.findByPk(managerId, { attributes: ['faculty_id'] });
    const officerPerformance = await User.findAll({
        where: { role: 'officer', faculty_id: manager.faculty_id }, // عزل الموظفين حسب الكلية
        attributes: ['id', 'full_name'],
        include: [{
            model: Complaint,
            where: { 
                status: 'resolved',
                category_id: filterWhere.category_id // الالتزام بالفلترة والعزل
            },
            attributes: ['createdAt', 'resolved_at', 'sla_deadline'], 
            required: false 
        }]
    });

    const formattedOfficers = officerPerformance.map(officer => {
        const resolvedComplaints = officer.Complaints || [];
        const officerTotalResolved = resolvedComplaints.length;
        
        let totalDays = 0;
        let onTimeComplaints = 0;

        resolvedComplaints.forEach(c => {
            if (c.resolved_at && c.createdAt) {
                const diffTime = Math.abs(new Date(c.resolved_at) - new Date(c.createdAt));
                totalDays += diffTime / (1000 * 60 * 60 * 24);
            }

            if (c.resolved_at && c.sla_deadline) {
                if (new Date(c.resolved_at) <= new Date(c.sla_deadline)) onTimeComplaints++;
            } else if (c.resolved_at && !c.sla_deadline) {
                onTimeComplaints++; 
            }
        });

        const avgTime = officerTotalResolved > 0 ? (totalDays / officerTotalResolved).toFixed(1) + 'd' : '0d';
        const slaCompliance = officerTotalResolved > 0 
            ? Math.round((onTimeComplaints / officerTotalResolved) * 100) + '%' 
            : '100%';

        return {
            id: officer.id,
            full_name: officer.full_name,
            totalResolved: officerTotalResolved,
            avgResolutionTime: avgTime,
            slaCompliance: slaCompliance
        };
    });

    return { totalComplaints, resolutionRate, slaBreachRate, appealRate, statusBreakdown, officerPerformance: formattedOfficers };
};

// =========================================================
// 2. Department Performance (عزل الاستعلام بـ الكلية)
// =========================================================
exports.departmentPerformanceService = async (managerId, filters = {}) => {
    const allowedCategoryIds = await getManagerCategoryIds(managerId);
    if (allowedCategoryIds.length === 0) return { departments: [] };

    const { from, to, category_id, status } = filters;
    
    // إجبار الاستعلام على فئات كليته فقط (Data Isolation)
    let whereClause = `WHERE s.department IS NOT NULL AND comp.category_id IN (:allowedCategoryIds)`;
    const replacements = { allowedCategoryIds };

    if (from && to) {
        whereClause += ` AND comp."createdAt" BETWEEN :from AND :to`;
        replacements.from = from;
        replacements.to = to;
    }
    if (category_id) {
        if (allowedCategoryIds.includes(parseInt(category_id))) {
            whereClause += ` AND comp.category_id = :category_id`;
            replacements.category_id = category_id;
        } else {
            return { error: "Unauthorized category selection." };
        }
    }
    if (status) {
        whereClause += ` AND comp.status = :status`;
        replacements.status = status.toLowerCase(); 
    }

    const results = await sequelize.query(`
        SELECT
            s.department AS name,
            COUNT(comp.id) AS total,
            COUNT(comp.id) FILTER (WHERE comp.status = 'resolved') AS resolved,
            AVG(EXTRACT(EPOCH FROM (comp.resolved_at - comp."createdAt")) / 3600.0) FILTER (WHERE comp.status = 'resolved') AS avg_hours
        FROM "Complaints" comp
        JOIN users u ON u.id = comp.user_id
        JOIN "Students" s ON s.id = u.student_id
        ${whereClause}
        GROUP BY s.department
        ORDER BY s.department ASC
    `, { 
        replacements, 
        type: sequelize.QueryTypes.SELECT 
    });

    return {
        departments: results.map(row => ({
            name: row.name,
            total: parseInt(row.total, 10) || 0,
            resolved: parseInt(row.resolved, 10) || 0,
            avg_hours: row.avg_hours !== null ? parseFloat(parseFloat(row.avg_hours).toFixed(1)) : 0
        }))
    };
};
 
// =========================================================
// 3. Heatmap Data (حقن الـ Isolation داخل الـ Switch Case)
// =========================================================
exports.heatmapService = async (managerId, dimension) => {
    const allowedCategoryIds = await getManagerCategoryIds(managerId);
    if (allowedCategoryIds.length === 0) return { heatmap: [] };

    let results;
    const replacements = { allowedCategoryIds };
 
    switch (dimension) {
        case 'category':
            results = await sequelize.query(`
                SELECT c.name AS label, COUNT(comp.id) AS count
                FROM categories c
                LEFT JOIN "Complaints" comp ON comp.category_id = c.id
                WHERE c.id IN (:allowedCategoryIds)  -- 🛑 Isolation
                GROUP BY c.name
                ORDER BY count DESC
            `, { replacements, type: sequelize.QueryTypes.SELECT });
            break;
 
        case 'location':
            results = await sequelize.query(`
                SELECT location AS label, COUNT(id) AS count
                FROM "Complaints"
                WHERE location IS NOT NULL AND category_id IN (:allowedCategoryIds) -- 🛑 Isolation
                GROUP BY location
                ORDER BY count DESC
            `, { replacements, type: sequelize.QueryTypes.SELECT });
            break;
 
        case 'time':
            results = await sequelize.query(`
                SELECT TO_CHAR("createdAt", 'YYYY-MM') AS label, COUNT(id) AS count
                FROM "Complaints"
                WHERE category_id IN (:allowedCategoryIds) -- 🛑 Isolation
                GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
                ORDER BY label ASC
            `, { replacements, type: sequelize.QueryTypes.SELECT });
            break;
 
        case 'department':
            results = await sequelize.query(`
                SELECT s.department AS label, COUNT(comp.id) AS count
                FROM "Complaints" comp
                JOIN users u ON u.id = comp.user_id
                JOIN "Students" s ON s.id = u.student_id
                WHERE s.department IS NOT NULL AND comp.category_id IN (:allowedCategoryIds) -- 🛑 Isolation
                GROUP BY s.department
                ORDER BY count DESC
            `, { replacements, type: sequelize.QueryTypes.SELECT });
            break;
 
        default:
            throw new Error('Invalid dimension.');
    }
 
    return {
        heatmap: results.map(row => ({
            label: row.label,
            count: parseInt(row.count, 10) || 0
        }))
    };
};
 
// =========================================================
// 4. Top Issues (إضافة العزل)
// =========================================================
exports.topIssuesService = async (managerId, categoryId = null) => {
    const allowedCategoryIds = await getManagerCategoryIds(managerId);
    if (allowedCategoryIds.length === 0) return { top_issues: [] };

    const whereCondition = {
        category_id: { [Op.in]: allowedCategoryIds } // 🛑 حماية الكلية
    };

    if (categoryId) {
        if (allowedCategoryIds.includes(parseInt(categoryId))) {
            whereCondition.category_id = categoryId;
        } else {
            throw new Error('Unauthorized category selection.');
        }
    }

    const topComplaints = await Complaint.findAll({
        where: whereCondition,
        attributes: [
            ['problem', 'issue_text'],
            [fn('COUNT', col('id')), 'repetition_count']
        ],
        group: ['problem'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 5,
        raw: true
    });

    return {
        top_issues: topComplaints.map((item, index) => ({
            id: index + 1,
            title: item.issue_text || "مشكلة غير محددة",
            count: parseInt(item.repetition_count, 10)
        }))
    };
};