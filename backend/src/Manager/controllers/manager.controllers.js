// استدعاء ملف السيرفس الموحد ودمج جميع الدوال الفعالة
const {
    
    getManagerDashboardStats, // الدالة الجديدة للداشبورد والـ Slicer
    overviewService,
    departmentPerformanceService,
    heatmapService,
    getRecommendationsService,
    updateRecommendationStatusService,
    reportsService,
    topIssuesService
} = require('../services/manager.service');

// =========================================================
// . Get Manager Dashboard Stats (مع الـ Slicer ديناميكياً)
// =========================================================
exports.getDashboardData = async (req, res) => {
    try {
        // لقط الـ category_id القادم من الـ Slicer في الفرونت إند (?category_id=3)
        const { category_id } = req.query; 

        // استدعاء الخدمة لحساب الإحصائيات الشاملة وأداء الموظفين
        const dashboardStats = await getManagerDashboardStats(category_id);
        
        return res.status(200).json({
            success: true,
            message: "Manager dashboard data retrieved successfully",
            data: dashboardStats
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

// =========================================================
// 2. Overview
// =========================================================
exports.overviewController = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { from } = req.query;
        const overviewData = await overviewService(userId, from);
        return res.status(200).json({
            success: true,
            message: "kpis returned successfully",
            overviewData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "there's an error",
            error: error.message
        });
    }
};

// =========================================================
// 3. Department Performance
// =========================================================
exports.departmentPerformanceController = async (req, res) => {
    try {
        const data = await departmentPerformanceService();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 4. Heatmap
// =========================================================
exports.heatmapController = async (req, res) => {
    try {
        const { dimension } = req.query;
        const data = await heatmapService(dimension);
        return res.status(200).json(data);
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 5. AI Recommendations
// =========================================================
exports.getRecommendationsController = async (req, res) => {
    try {
        const data = await getRecommendationsService();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 6. Update Recommendation Status
// =========================================================
exports.updateRecommendationStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const data = await updateRecommendationStatusService(id, status);
        return res.status(200).json(data);
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 7. Reports
// =========================================================
exports.reportsController = async (req, res) => {
    try {
        const { from, to, category_id, status } = req.query;
        const data = await reportsService({ from, to, category_id, status });
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 8. Top Issues per Category
// =========================================================
exports.topIssuesController = async (req, res) => {
    try {
        const { category_id } = req.params;
        const data = await topIssuesService(category_id);
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};