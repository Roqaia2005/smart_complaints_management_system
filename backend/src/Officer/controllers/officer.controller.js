// استدعاء ملف السيرفس الموحد
const {
    getDepartmentComplaintsService,
    getComplaintDetailsService,
    updateComplaintStatusService,
    getAppealedComplaintsService,
    markAppealReviewedService,
    getOfficerDashboardStats,
    getAllOfficersService  // ← add this
} = require('../services/officer.service');

// =========================================================
// 1. Get Department (Category) Complaints
// =========================================================
exports.getDepartmentComplaintsController = async (req, res) => {
    try {
        const officerId = req.user.id; // من الـ token
        const { category_id } = req.query; // optional

        const data = await getDepartmentComplaintsService(officerId, category_id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 2. Get Complaint Details
// =========================================================
exports.getComplaintDetailsController = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getComplaintDetailsService(id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 3. Update Complaint Status
// =========================================================
exports.updateComplaintStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_text } = req.body;

        // تأمين لتجنب مشاكل الحروف الصغيرة لو الفرونت إند بعتها سمول
        let formattedStatus = status;
        if (status && status.toLowerCase() === 'in_progress') formattedStatus = 'In_Progress';
        if (status && status.toLowerCase() === 'resolved') formattedStatus = 'Resolved';

        const data = await updateComplaintStatusService(id, formattedStatus, resolution_text);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 4. Get Appealed Complaints
// =========================================================
exports.getAppealedComplaintsController = async (req, res) => {
    try {
        const { category_id } = req.query;

        if (!category_id) {
            return res.status(400).json({
                success: false,
                error: 'category_id is required'
            });
        }

        const data = await getAppealedComplaintsService(category_id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 5. Mark Appeal as Reviewed
// =========================================================
exports.markAppealReviewedController = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await markAppealReviewedService(id);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 6. Get Officer Dashboard (مع ضبط الـ Slicer بالكامل)
// =========================================================
exports.getDashboard = async (req, res) => {
    try {
        // 1. لقط الـ Slicer والـ officer_id من الرابط مباشرة لتسهيل الاختبار في المتصفح
        const { category_id } = req.query; // (?category_id=all)
        const officerId = req.query.officer_id || 36; // لقط الـ ID أو افتراض 36 لو مش مبعوث

        // 2. استدعاء السيرفس لحساب الإحصائيات بناءً على القيم القادمة من الرابط
        const stats = await getOfficerDashboardStats(officerId, category_id);
        
        return res.status(200).json({ 
            success: true, 
            data: stats 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};
// =========================================================
// 7. Get All Officers
// =========================================================
exports.getAllOfficersController = async (req, res) => {
    try {
        const data = await getAllOfficersService();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};