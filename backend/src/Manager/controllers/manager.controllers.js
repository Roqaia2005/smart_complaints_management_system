// استدعاء ملف السيرفس الموحد ودمج جميع الدوال الفعالة
const {
    getManagerDashboardStats, 
    overviewService,
    departmentPerformanceService,
    heatmapService,
    getRecommendationsService,
    updateRecommendationStatusService,
    reportsService,
    topIssuesService,
    getManagerCategoriesWithPriorityService
} = require('../services/manager.service');

// =========================================================
// 1. Get Manager Dashboard Stats (مع الـ Slicer ديناميكياً)
// =========================================================
exports.getDashboardData = async (req, res) => {
    try {
        const managerId = req.user.id; // حماية: لقط الـ ID من الـ Token لمنع التلاعب
        const { category_id } = req.query; // القادم من الـ Slicer في الفرونت إند

        // تمرير الـ managerId للسيرفس لتطبيق العزل
        const dashboardStats = await getManagerDashboardStats(managerId, category_id);
        
        return res.status(200).json({
            success: true,
            message: "Manager dashboard data retrieved successfully",
            data: dashboardStats
        });
    } catch (error) {
        // تمييز خطأ عدم الصلاحية (403) عن أخطاء السيرفر الحقيقية (500)
        if (error.message === 'Unauthorized category selection.') {
            return res.status(403).json({
                success: false,
                message: "Unauthorized category selection",
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

// =========================================================
// 2. Department Performance
// =========================================================
exports.departmentPerformanceController = async (req, res) => {
    try {
        const managerId = req.user.id; // حماية لضمان عزل الأقسام (Data Isolation)
        const filters = req.query; // استقبال الفلاتر (from, to, category_id, status)
        
        // تمرير الـ managerId والـ filters معاً للسيرفس المعدلة
        const data = await departmentPerformanceService(managerId, filters);
        
        // لو السيرفس رجعت خطأ عدم صلاحية الـ Category لفئات المدير
        if (data.error) {
            return res.status(403).json({
                success: false,
                error: data.error
            });
        }

        // الـ Response هيرجع تلقائياً جواه المؤشرات الجديدة:
        // (name, total, resolved, resolved_within_deadline, resolved_after_deadline)
        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 3. Heatmap
// =========================================================
exports.heatmapController = async (req, res) => {
    try {
        const managerId = req.user.id; // حماية لضمان عزل خريطة الكلية
        const { dimension, categoryIds } = req.query;

        if (!dimension) {
            throw new Error('Dimension parameter is required (category, location, time, or department).');
        }

        // categoryIds ممكن تيجي كـ "1,2,3" أو كـ array (categoryIds=1&categoryIds=2)
        let filterCategoryIds;
        if (categoryIds) {
            filterCategoryIds = Array.isArray(categoryIds)
                ? categoryIds
                : categoryIds.split(',').map(id => id.trim()).filter(Boolean);
        }

        const data = await heatmapService(managerId, dimension, filterCategoryIds);
        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 4. Top Issues
// =========================================================
// =========================================================
exports.topIssuesController = async (req, res) => {
    try {
        const managerId = req.user.id;
        const { category_id } = req.query;
 
        const data = await topIssuesService(managerId, category_id || null);
 
        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getManagerCategoriesController = async (req, res) => {
  try {
    // جلب كلية المانجر من الـ Auth Middleware لمنع أي مانجر من رؤية كليات أخرى
    const facultyId = req.user?.faculty_id || req.user?.facultyId;

    if (!facultyId) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied. Manager faculty info not found." 
      });
    }

    const categories = await getManagerCategoriesWithPriorityService(facultyId);

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });

  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};