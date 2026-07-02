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

    let selectedCategoryId = null;
    if (categoryId && categoryId !== 'all') {
        if (allowedCategoryIds.includes(parseInt(categoryId))) {
            selectedCategoryId = parseInt(categoryId);
            filterWhere.category_id = selectedCategoryId;
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

    // 3. حساب الـ SLA Breach (dynamic من sla_hours بتاع الكاتيجوري، مش عمود ثابت)
    const breachResult = await sequelize.query(`
        SELECT COUNT(comp.id) AS breached
        FROM "Complaints" comp
        JOIN "categories" cat ON cat.id = comp.category_id
        WHERE comp.category_id IN (:allowedCategoryIds)
        ${selectedCategoryId ? 'AND comp.category_id = :selectedCategoryId' : ''}
        AND comp.status = 'resolved'
        AND cat.sla_hours IS NOT NULL
        AND comp.resolved_at > comp."createdAt" + (cat.sla_hours || ' hours')::interval
    `, {
        replacements: { allowedCategoryIds, selectedCategoryId },
        type: sequelize.QueryTypes.SELECT
    });
    const breachedCount = parseInt(breachResult[0]?.breached, 10) || 0;
    const slaBreachRate = totalComplaints > 0 ? Math.round((breachedCount / totalComplaints) * 100) + '%' : '0%';

    // 4. أداء الموظفين الحقيقي التابعين لكليته فقط
    const manager = await User.findByPk(managerId, { attributes: ['faculty_id'] });

    // خريطة sla_hours لكل category عشان نحسب الـ deadline dynamic لكل شكوى
    const categoriesData = await Category.findAll({
        where: { id: { [Op.in]: allowedCategoryIds } },
        attributes: ['id', 'sla_hours']
    });
    const slaHoursMap = {};
    categoriesData.forEach(cat => { slaHoursMap[cat.id] = cat.sla_hours; });

    const officerPerformance = await User.findAll({
        where: { role: 'officer', faculty_id: manager.faculty_id }, // عزل الموظفين حسب الكلية
        attributes: ['id', 'full_name'],
        include: [{
            model: Complaint,
            as: 'AssignedComplaints', // ← ده الأول: يحدد الـ alias الصح (الموظف المسؤول، مش الطالب صاحب الشكوى)
            where: { 
                status: 'resolved',
                category_id: filterWhere.category_id // الالتزام بالفلترة والعزل
            },
            attributes: ['createdAt', 'resolved_at', 'category_id'],
            required: false 
        }]
    });

    const formattedOfficers = officerPerformance.map(officer => {
        const resolvedComplaints = officer.AssignedComplaints || []; // ← ده التاني: يقرا من الـ alias الجديد بدل الافتراضي
        const officerTotalResolved = resolvedComplaints.length;
        
        let totalDays = 0;
        let comparableComplaints = 0; // الشكاوى اللي ليها sla_hours معروف فقط
        let onTimeComplaints = 0;

        resolvedComplaints.forEach(c => {
            if (c.resolved_at && c.createdAt) {
                const diffTime = Math.abs(new Date(c.resolved_at) - new Date(c.createdAt));
                totalDays += diffTime / (1000 * 60 * 60 * 24);
            }

            const slaHours = slaHoursMap[c.category_id];
            if (c.resolved_at && c.createdAt && slaHours) {
                comparableComplaints++;
                const deadline = new Date(new Date(c.createdAt).getTime() + slaHours * 60 * 60 * 1000);
                if (new Date(c.resolved_at) <= deadline) onTimeComplaints++;
            }
            // لو الكاتيجوري مالهاش sla_hours متعرّف، بنستبعدها من الحساب بدل ما نفترضها on-time
        });

        const avgTime = officerTotalResolved > 0 ? (totalDays / officerTotalResolved).toFixed(1) + 'd' : '0d';
        const slaCompliance = comparableComplaints > 0
            ? Math.round((onTimeComplaints / comparableComplaints) * 100) + '%'
            : 'N/A';

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
// =========================================================
exports.departmentPerformanceService = async (managerId, filters = {}) => {
  // 1. جلب الـ faculty_id الخاص بالمدير
  const manager = await User.findByPk(managerId, { attributes: ['faculty_id'] });
  if (!manager || !manager.faculty_id) {
      throw new Error("Manager faculty context not found.");
  }
  const numericFacultyId = Number(manager.faculty_id);
  const { from, to, category_id, status } = filters;

  // 2. جلب الـ Categories التابعة لكلية هذا المدير (اللي هي 18 في حالتك)
  const managerCategories = await sequelize.query(
    `SELECT id FROM "categories" WHERE faculty_id = :numericFacultyId`,
    { replacements: { numericFacultyId }, type: sequelize.QueryTypes.SELECT }
  );
  
  const categoryIds = managerCategories.map(c => c.id);
  if (categoryIds.length === 0) {
      return { departments: [] }; 
  }

  // 3. شروط الـ WHERE المبنية على فئات كلية المدير الحالي
  let whereClause = `WHERE comp.category_id IN (:categoryIds)`;
  const replacements = { categoryIds };
  
  if (from && to) {
      whereClause += ` AND comp."createdAt" BETWEEN :from AND :to`;
      replacements.from = from;
      replacements.to = to;
  }
  
  if (category_id) {
      const selectedCatId = parseInt(category_id, 10);
      if (categoryIds.includes(selectedCatId)) {
          whereClause += ` AND comp.category_id = :selectedCatId`;
          replacements.selectedCatId = selectedCatId;
      } else {
          return { error: "Unauthorized category selection." };
      }
  }
  
  if (status) {
      whereClause += ` AND comp.status = :status`;
      replacements.status = status.toLowerCase(); 
  }

  // 4. الاستعلام المرن بـ LEFT JOIN المصلح للـ Grouping والـ Nulls
  const results = await sequelize.query(`
      SELECT
          COALESCE(s.department, 'General Administration') AS name,
          COUNT(comp.id) AS total,
          COUNT(comp.id) FILTER (WHERE comp.status = 'resolved') AS resolved,
          COUNT(comp.id) FILTER (WHERE comp.status = 'resolved' AND comp.resolved_at <= comp.sla_deadline) AS resolved_within_deadline,
          COUNT(comp.id) FILTER (WHERE comp.status = 'resolved' AND comp.resolved_at > comp.sla_deadline) AS resolved_after_deadline
      FROM public."Complaints" comp
      INNER JOIN public.users u ON comp.user_id = u.id
      LEFT JOIN public."Students" s ON u.student_id = s.id -- 🌟 هنا LEFT JOIN عشان الـ student_id = null ميتلغيش
      ${whereClause}
      GROUP BY COALESCE(s.department, 'General Administration') -- 🌟 تجميع صح يمنع تدمير الـ Rows
      ORDER BY name ASC
  `, { 
      replacements, 
      type: sequelize.QueryTypes.SELECT 
  });

  // 5. إرسال النتيجة للفرونت إند
  return {
      departments: results.map(row => ({
          name: row.name,
          total: parseInt(row.total, 10) || 0,
          resolved: parseInt(row.resolved, 10) || 0,
          resolved_within_deadline: parseInt(row.resolved_within_deadline, 10) || 0,
          resolved_after_deadline: parseInt(row.resolved_after_deadline, 10) || 0
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
exports.topIssuesService = async (managerId, categoryId = null) => {
 
    const manager = await User.findByPk(managerId, { attributes: ['faculty_id'] });
   
    if (!manager || !manager.faculty_id) {
        throw new Error("Manager faculty context not found.");
    }
    const numericFacultyId = Number(manager.faculty_id);
  //console.log('DEBUG topIssues:', { managerId, numericFacultyId, categoryId });
// بعد (صح)
let whereClause = 'WHERE cat.faculty_id = :numericFacultyId';
const replacements = { numericFacultyId }; // ← ضيف السطر ده هنا

if (categoryId) {
    whereClause += ' AND comp.category_id = :selectedCatId';
    replacements.selectedCatId = Number(categoryId);
}
 
    const topComplaints = await sequelize.query(`
        SELECT 
            TRIM(comp.problem) AS issue_text,
            COUNT(*) AS repetition_count
        FROM public."Complaints" comp
        INNER JOIN public.categories cat ON comp.category_id = cat.id
        ${whereClause}
        GROUP BY TRIM(comp.problem)
        ORDER BY repetition_count DESC
        LIMIT 5
    `, {
        replacements,
        type: sequelize.QueryTypes.SELECT
    });
 
    return {
        top_issues: topComplaints.map((item, index) => ({
            id: index + 1,
            title: item.issue_text || "مشكلة غير محددة",
            count: parseInt(item.repetition_count, 10) || 0
        }))
    };
};

// دالة مساعدة لضمان تحويل الـ Count لرقم صريح
function relativeCount(val) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
}