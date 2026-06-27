const { Op } = require('sequelize');
const {  fn, col } = require('sequelize');

const db = require('../../../models');

const { 
    Complaint, 
    Category,
    Appeal,
    AiRecommendation,
    AnalysisReport,
    User,
    sequelize 
} = db;

// =========================================================
// ا Get Manager Dashboard Stats (مع الـ Slicer)
// =========================================================
exports.getManagerDashboardStats = async (categoryId) => {
    let filterWhere = {};
    if (categoryId && categoryId !== 'all') {
        filterWhere.category_id = categoryId;
    }

    // 1. إجمالي الشكاوى
    const totalComplaints = await Complaint.count({ where: filterWhere });

    // 2. توزيع الحالات (Status Breakdown) بالـ % الحقيقي
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

    // 3. حساب نسب الإحصائيات العامة من الداتابيز مباشرة
    const resolutionRate = totalComplaints > 0 ? Math.round((totalResolved / totalComplaints) * 100) + '%' : '0%';
    const appealRate = totalComplaints > 0 ? Math.round((totalAppealed / totalComplaints) * 100) + '%' : '0%';

    // حساب الـ SLA Breach (الشكاوى التي تجاوزت الـ Deadline)
    const breachedCount = await Complaint.count({
        where: {
            ...filterWhere,
            sla_deadline: { [Op.lt]: sequelize.col('resolved_at') } // الوقت الفعلي أكبر من المسموح
        }
    });
    const slaBreachRate = totalComplaints > 0 ? Math.round((breachedCount / totalComplaints) * 100) + '%' : '0%';

    // 4. أداء الموظفين الحقيقي وحساب الـ SLA Compliance لكل موظف
    const officerPerformance = await User.findAll({
        where: { role: 'officer' },
        attributes: ['id', 'full_name'],
        include: [{
            model: Complaint,
            where: { 
                status: 'resolved',
                ...(categoryId && categoryId !== 'all' ? { category_id: categoryId } : {})
            },
            attributes: ['createdAt', 'resolved_at', 'sla_deadline'], 
            required: false 
        }]
    });

    const formattedOfficers = officerPerformance.map(officer => {
        const resolvedComplaints = officer.Complaints || [];
        const officerTotalResolved = resolvedComplaints.length;
        
        let totalDays = 0;
        let onTimeComplaints = 0; // الشكاوى اللي اتحلت في الميعاد أو قبله

        resolvedComplaints.forEach(c => {
            // حساب متوسط وقت الحل بالأيام
            if (c.resolved_at && c.createdAt) {
                const diffTime = Math.abs(new Date(c.resolved_at) - new Date(c.createdAt));
                totalDays += diffTime / (1000 * 60 * 60 * 24);
            }

            // فحص هل التزم بالـ SLA؟
            if (c.resolved_at && c.sla_deadline) {
                if (new Date(c.resolved_at) <= new Date(c.sla_deadline)) {
                    onTimeComplaints++;
                }
            } else if (c.resolved_at && !c.sla_deadline) {
                // لو الموظف حلها ومكنش ليها deadline أصلاً، بنعتبرها التزام
                onTimeComplaints++; 
            }
        });

        const avgTime = officerTotalResolved > 0 ? (totalDays / officerTotalResolved).toFixed(1) + 'd' : '0d';
        
        // حساب نسبة الالتزام الحقيقية للموظف
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

    return {
        totalComplaints,
        resolutionRate,
        slaBreachRate, 
        appealRate,    
        statusBreakdown, 
        officerPerformance: formattedOfficers 
    };
};
// =========================================================
// 1. Department Performance
// =========================================================
exports.departmentPerformanceService = async (filters = {}) => {
    const { from, to, category_id, status } = filters;
    
    // بناء شروط الـ WHERE بالتدريج بناءً على الـ Params المبعوتة
    let whereClause = `WHERE s.department IS NOT NULL`;
    const replacements = {};

    if (from && to) {
        whereClause += ` AND comp."createdAt" BETWEEN :from AND :to`;
        replacements.from = from;
        replacements.to = to;
    }
    if (category_id) {
        whereClause += ` AND comp.category_id = :category_id`;
        replacements.category_id = category_id;
    }
    if (status) {
        // بنحولها lowercase عشان مشاكل الـ ENUM
        whereClause += ` AND comp.status = :status`;
        replacements.status = status.toLowerCase(); 
    }

    const results = await sequelize.query(`
        SELECT
            s.department AS name,
            COUNT(comp.id) AS total,
            -- شيلنا الحرف الكابتل هنا عشان الـ ENUM ميعملش Error
            COUNT(comp.id) FILTER (WHERE comp.status = 'resolved') AS resolved,
            AVG(
                EXTRACT(EPOCH FROM (comp.resolved_at - comp."createdAt")) / 3600.0
            ) FILTER (WHERE comp.status = 'resolved') AS avg_hours
        FROM "Complaints" comp
        JOIN users u ON u.id = comp.user_id
        JOIN "Students" s ON s.id = u.student_id
        ${whereClause}
        GROUP BY s.department
        ORDER BY s.department ASC
    `, { 
        replacements, // حماية من الـ SQL Injection
        type: sequelize.QueryTypes.SELECT 
    });

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
 


exports.topIssuesService = async (categoryId = null) => {
    // بنجهز شرط الـ where بناءً على وجود الـ categoryId
    const whereCondition = {};
    if (categoryId) {
        whereCondition.category_id = categoryId;
    }

    // بنجيب المشاكل الأكثر تكراراً (Top Issues) عن طريق الـ Group By والـ Count
    const topComplaints = await Complaint.findAll({
        where: whereCondition,
        attributes: [
            ['problem', 'issue_text'], // بناخد نص المشكلة ونسميه issue_text
            [fn('COUNT', col('id')), 'repetition_count'] // بنعد تكرار كل مشكلة
        ],
        group: ['problem'], // تجميع بناءً على نص المشكلة
        order: [[fn('COUNT', col('id')), 'DESC']], // الترتيب من الأكثر تكراراً للأقل
        limit: 5, // بنجيب أعلى 5 مشاكل متكررة مثلاً
        raw: true // عشان يرجع داتا صافية علطول
    });

    // لو مفيش أي شكاوى في الجدول خالص، بنرجع مصفوفة فاضية عشان الـ Front-end ميعملش كراش
    if (!topComplaints || topComplaints.length === 0) {
        return { top_issues: [] };
    }

    // بنظف شكل الداتا النهائي عشان يطابق الـ Response المتوقع
    const topIssues = topComplaints.map((item, index) => ({
        id: index + 1, // بنعمل ID وهمي للـ Front-end
        title: item.issue_text || "مشكلة غير محددة", // نص المشكلة
        count: parseInt(item.repetition_count, 10) // عدد مرات التكرار
    }));

    return { top_issues: topIssues };
};