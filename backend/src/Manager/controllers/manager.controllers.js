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
// 3. Department Performance
// =========================================================
exports.departmentPerformanceController = async (req, res) => {
    try {
        // بنستقبل الـ params المبعوتة في الـ URL زي (from, to, category_id, status)
        const filters = req.query; 
        
        const data = await departmentPerformanceService(filters);
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


exports.topIssuesController = async (req, res) => {
    try {
        // بنقرأ الـ category_id من الـ Query String دلوقتي
        const { category_id } = req.query;
        
        const data = await topIssuesService(category_id || null);
        
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};