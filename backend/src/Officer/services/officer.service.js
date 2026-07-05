const { Op } = require('sequelize');
const db = require('../../../models');
const {
    Complaint,
    Category,
    Appeal,
    User,
    Student,
    ComplaintHistory,
    CategoryOfficer,
    PriorityRules,
    sequelize
} = db;

// 💡 دالة مساعدة داخلية (Helper) لمنع تكرار الكود: تجيب الـ IDs المسموحة للموظف
const getOfficerCategoryIds = async (officerId) => {
    const assigned = await CategoryOfficer.findAll({
        where: { officer_id: officerId },
        attributes: ['category_id']
    });
    return assigned.map(c => c.category_id);
};

// =========================================================
// 1. Get Department Complaints (تأمين كامل ضد الـ SQL Injection)
// =========================================================
exports.getDepartmentComplaintsService = async (officerId, categoryId = null) => {
    const categoryIds = await getOfficerCategoryIds(officerId);

    if (categoryIds.length === 0) return { complaints: [] };

    // التحقق من الصلاحية لو باعت Category معينة
    if (categoryId) {
        if (!categoryIds.includes(parseInt(categoryId))) {
            return { complaints: [] }; 
        }
    }

    // تحديد الفئات المستهدفة بناءً على المدخلات
    const targetCategories = categoryId ? [parseInt(categoryId)] : categoryIds;

    // استخدام الـ replacements لمنع الـ SQL Injection نهائياً
    const results = await sequelize.query(`
        SELECT
            comp.id,
            comp.problem,
            comp.ai_summary,
            comp.priority,
            comp.status,
            comp.category_id,
            s.full_name AS student_name,
            comp."createdAt" AS created_at
        FROM "Complaints" comp
        JOIN users u ON u.id = comp.user_id
        LEFT JOIN "Students" s ON s.id = u.student_id
        WHERE comp.category_id IN (:targetCategories)
        ORDER BY comp.priority DESC, comp."createdAt" DESC
    `, {
        replacements: { targetCategories },
        type: sequelize.QueryTypes.SELECT
    });

    return { complaints: results };
};

// =========================================================
// 2. Get Complaint Details (مؤمنة بالـ Isolation)
// =========================================================
exports.getComplaintDetailsService = async (complaintId, officerId) => {
    const categoryIds = await getOfficerCategoryIds(officerId);

    const complaint = await Complaint.findOne({
        where: { 
            id: complaintId,
            category_id: { [Op.in]: categoryIds } 
        },
        include: [{ model: Category, attributes: ['id', 'name'] }]
    });

    if (!complaint) {
        throw new Error('Complaint not found or you do not have permission to view it.');
    }

    const user = await User.findByPk(complaint.user_id, { include: [{ model: Student }] });
    const student = user && user.Student ? {
        name: user.Student.full_name,
        department: user.Student.department,
        academic_year: user.Student.academic_year
    } : null;

    return { complaint, student };
};

// =========================================================
// 3. Update Complaint Status (تأمين الـ Isolation والـ Transaction)
// =========================================================
exports.updateComplaintStatusService = async (complaintId, status, resolutionText, officerId) => {
    const allowedStatuses = ['in_progress', 'resolved']; 
    const lowerStatus = status.toLowerCase();

    if (!allowedStatuses.includes(lowerStatus)) {
        throw new Error(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`);
    }

    // تعديل: استخدام .trim() للتأكد أن الـ text ليس فارغاً أو مجرد مسافات
    if (lowerStatus === 'resolved' && (!resolutionText || !resolutionText.trim())) {
        throw new Error('resolution_text is required when status is Resolved');
    }

    const categoryIds = await getOfficerCategoryIds(officerId);
    let t;

    try {
        t = await sequelize.transaction();

        const complaint = await Complaint.findOne({
            where: { 
                id: complaintId,
                category_id: { [Op.in]: categoryIds }
            },
            transaction: t 
        });

        if (!complaint) {
            throw new Error('Complaint not found or you do not have permission to modify it.');
        }

        const updateData = { status: lowerStatus };
        if (lowerStatus === 'resolved') {
            updateData.resolution_text = resolutionText.trim(); // حفظ النص بعد تنظيفه
            updateData.resolved_at = new Date();
        }

        await complaint.update(updateData, { transaction: t });
        
        await ComplaintHistory.create({
            complaint_id: complaint.id,
            status: lowerStatus,
            changed_by: officerId, 
            changed_at: new Date()
        }, { transaction: t });

        await t.commit();
        return { success: true };

    } catch (error) {
        if (t) await t.rollback();
        throw error;
    }
};

// =========================================================
// 4. Get Appealed Complaints (مؤمنة لمنع سحب بيانات كليات أخرى)
// =========================================================
exports.getAppealedComplaintsService = async (officerId, categoryId = null) => {
    const categoryIds = await getOfficerCategoryIds(officerId);
    
    let targetCategories = categoryIds;
    if (categoryId) {
        if (!categoryIds.includes(parseInt(categoryId))) {
            return { appeals: [] };
        }
        targetCategories = [parseInt(categoryId)];
    }

    const appeals = await Appeal.findAll({
        where: { status: 'pending' }, 
        include: [{
            model: Complaint,
            where: { category_id: { [Op.in]: targetCategories } }, 
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
exports.markAppealReviewedService = async (appealId, responseText, officerId) => {
    // التأكد أن نص الرد تم إرساله وليس فارغاً
    if (!responseText || !responseText.trim()) {
        throw new Error('response_text is required to review this appeal.');
    }

    const categoryIds = await getOfficerCategoryIds(officerId);

    // البحث عن الالتماس مع التحقق من الصلاحية (Isolation)
    const appeal = await Appeal.findOne({
        where: { id: appealId }, 
        include: [{
            model: Complaint,
            where: { category_id: { [Op.in]: categoryIds } },
            required: true
        }]
    });

    if (!appeal) {
        throw new Error('Appeal not found or you do not have permission to review it.');
    }

    // تحديث بيانات الالتماس وحفظ نص الرد في العمود الصحيح
    appeal.status = 'reviewed'; 
    appeal.response_text = responseText.trim(); // ✅ الاسم المطابق للسكيمة بالظبط
    appeal.responded_at = new Date();
    appeal.responded_by = officerId;
    await appeal.save();

    //  نظام الإشعارات التلقائي
    try {
        const { Notification } = db; 
        await Notification.create({
            user_id: appeal.Complaint.user_id, 
            title: 'Appeal Reviewed by Administration',
            message: `Your appeal for complaint number #${appeal.complaint_id} has been reviewed. Remarks: ${responseText.trim()}`
        });
        console.log(`Notification triggered successfully for user: ${appeal.Complaint.user_id}`);
    } catch (notifyError) {
        console.error('Notification Error but appeal saved:', notifyError.message);
    }

    return { success: true };
};
// =========================================================
// 6. Get Officer Dashboard Stats (تحسين جبار في الأداء باستخدام الـ Aggregation)
// =========================================================
exports.getOfficerDashboardStats = async (officerId, categoryId = null) => {
    const categoryIds = await getOfficerCategoryIds(officerId);

    if (categoryIds.length === 0) {
        return { openComplaints: 0, resolvedThisMonth: 0, avgResolutionTime: "0d", slaCompliance: "100%", recentComplaints: [] };
    }

    let whereClause = {
        category_id: { [Op.in]: categoryIds } 
    };
    
    if (categoryId && categoryId !== 'all') {
        if (categoryIds.includes(parseInt(categoryId))) {
            whereClause.category_id = parseInt(categoryId);
        } else {
            return { error: "Unauthorized category selection." };
        }
    }

    // 1. حساب الشكاوى المفتوحة
    const openComplaints = await Complaint.count({ where: { ...whereClause, status: 'pending' } });
    
    // 2. حساب الشكاوى المحلولة
    const resolvedMonth = await Complaint.count({ where: { ...whereClause, status: 'resolved' } });
    
    // 3. حساب المتوسط ونسبة الـ SLA ديناميكياً بناءً على ساعات القسم (sla_hours)
    // بنعمل INNER JOIN مع جدول categories بناءً على الـ category_id المحقق للشرط
    const stats = await Complaint.findOne({
        where: { ...whereClause, status: 'resolved' },
        attributes: [
            // حساب متوسط أيام الحل للشكاوى
            [sequelize.fn('AVG', sequelize.literal('EXTRACT(EPOCH FROM ("Complaint"."resolved_at" - "Complaint"."createdAt")) / 86400')), 'avgDays'],
            
            // حساب نسبة الـ SLA ديناميكياً:
            // بنحسب الوقت المستغرق بالوجيز (بالساعات): EXTRACT(EPOCH FROM (resolved_at - createdAt)) / 3600
            // وبنقارنه بعمود c.sla_hours القادم من جدول الـ categories
            [sequelize.literal(`
                COALESCE(
                    (COUNT(
                        CASE 
                            WHEN (EXTRACT(EPOCH FROM ("Complaint"."resolved_at" - "Complaint"."createdAt")) / 3600) <= "Category"."sla_hours" 
                            THEN 1 
                        END
                    ) * 100.0) / NULLIF(COUNT(*), 0), 
                    100
                )
            `), 'slaPercentage']
        ],
        // عمل ربط (Join) مع موديل الـ Category لجلب الـ sla_hours داخل الكويري
        include: [{
            model: Category,
            attributes: [], // مش محتاجين نرجع داتا عادية منها، فقط مستخدمينها في الـ Literal فوق
            required: true // INNER JOIN
        }],
        raw: true
    });

    const avgTime = stats && stats.avgDays ? parseFloat(stats.avgDays).toFixed(1) + 'd' : "0d";
    // إذا كانت نسبة الـ SLA غير موجودة (مثلا مفيش شكاوى محلولة أصلاً) بنرجع 100% كافتراضي
    const slaCompliance = stats && stats.slaPercentage ? Math.round(parseFloat(stats.slaPercentage)) + '%' : "100%";

    // 4. جلب أحدث 5 شكاوى فقط للـ Dashboard
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
        slaCompliance: slaCompliance, 
        recentComplaints
    };
};

// =========================================================
// 7. Get All Officers (for complaint escalation/assignment)
// =========================================================
exports.getAllOfficersService = async (currentOfficerId, facultyId) => {
    // التحقق من وجود الكلية لمنع جلب بيانات خاطئة
    if (!facultyId) {
        return { officers: [] };
    }

    const officers = await User.findAll({
        where: {
            role: 'officer',
            is_active: true,
            faculty_id: facultyId,          // يجيب فقط الموظفين اللي في نفس الكلية
            id: { [Op.ne]: currentOfficerId } // يستثني الموظف الحالي (نفسه) من القائمة
        },
        attributes: ['id', 'full_name', 'email', 'role', 'faculty_id'],
        order: [['full_name', 'ASC']]
    });

    return { officers };
};

exports.getAssignedCategoriesService = async (officerId) => {
  // Step 1: get the category IDs assigned to this officer
  const assigned = await CategoryOfficer.findAll({
    where: { officer_id: officerId },
    attributes: ['category_id']
  });

  if (assigned.length === 0) return { categories: [] };

  const categoryIds = assigned.map(a => a.category_id);

  // Step 2: fetch category names directly from Category model
  const categories = await Category.findAll({
    where: { id: categoryIds },
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });

  return { categories };
};

exports.escalateComplaintService = async (complaintId, targetOfficerId, currentOfficerId) => {
  const categoryIds = await getOfficerCategoryIds(currentOfficerId);

  // Verify current officer owns this complaint
  const complaint = await Complaint.findOne({
    where: {
      id: complaintId,
      category_id: { [Op.in]: categoryIds }
    },
    include: [{ model: Category, attributes: ['id', 'faculty_id'] }]
  });

  if (!complaint) {
    throw new Error('Complaint not found or you do not have permission to escalate it.');
  }

  if (!complaint.Category) {
    throw new Error('Complaint category data could not be loaded.');
  }

  // Verify target officer exists, is active, and is in the same faculty
  // (category check removed — can escalate to any officer in the faculty)
  const targetOfficer = await User.findOne({
    where: {
      id: targetOfficerId,
      role: 'officer',
      is_active: true,
      faculty_id: complaint.Category.faculty_id
    }
  });

  if (!targetOfficer) {
    throw new Error('Target officer not found or not eligible.');
  }

  if (targetOfficer.id === currentOfficerId) {
    throw new Error('Cannot escalate to yourself.');
  }

  const t = await sequelize.transaction();
  try {
    await complaint.update({
      assigned_officer_id: targetOfficerId,
      status: 'in_progress'
    }, { transaction: t });

    await ComplaintHistory.create({
      complaint_id: complaint.id,
      status: 'in_progress',
      changed_by: currentOfficerId,
      changed_at: new Date()
    }, { transaction: t });

    await t.commit();
    return { success: true };

  } catch (error) {
    await t.rollback();
    throw error;
  }
};


exports.getOfficerCategoriesWithPriorityService = async (officerId, facultyId) => {
  const categories = await Category.findAll({
    where: { 
      faculty_id: Number(facultyId) // عزل على مستوى الكلية
    },
    // تحديد الحقول المطلوبة فقط من جدول الكاتيجوري
    attributes: ["id", "faculty_id", "name", "description", "sla_hours", "is_active", "is_other"],
    include: [
      {
        model: PriorityRules,
        attributes: ["priority_level"],
        required: false
      },
      {
        model: User,
        as: "officers", // الـ Alias المعرف في الموديل عندك
        where: { id: officerId }, // الـ Data Isolation: الأقسام المربوطة بالموظف ده بس
        attributes: [], 
        through: { attributes: [] } 
      }
    ],
    order: [
      [PriorityRules, "priority_level", "ASC"], 
      ["name", "ASC"]
    ]
  });

  // تنظيف الـ Response وتحويل الـ PriorityRules لحقل مباشر ونضيف
  return categories.map(cat => {
    const categoryJson = cat.toJSON();
    // أخذ أول عنصر من المصفوفة لو موجود
    const priorityRule = categoryJson.PriorityRules && categoryJson.PriorityRules[0];
    
    // دمج الـ priority_level وحذف المصفوفة الزائدة
    categoryJson.priority_level = priorityRule ? priorityRule.priority_level : null;
    delete categoryJson.PriorityRules;
    
    // حذف الـ officers array اللي بتطلع تلقائياً بسبب الـ include
    delete categoryJson.officers; 
    
    return categoryJson;
  });
};