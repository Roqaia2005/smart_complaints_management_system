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
        const officerId = req.user.id; // حماية: جلب الـ ID من الـ Token
        const { category_id } = req.query; // اختياري لعمل فلترة

        const data = await getDepartmentComplaintsService(officerId, category_id);
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
// 2. Get Complaint Details
// =========================================================
exports.getComplaintDetailsController = async (req, res) => {
    try {
        const officerId = req.user.id; // تمريره للسيرفس لضمان الـ Isolation
        const { id } = req.params;

        const data = await getComplaintDetailsService(id, officerId);
        return res.status(200).json({
            success: true,
            ...data
        });

    } catch (error) {
        // لو الـ Error بسبب الصلاحيات يفضل يرجع 403 (Forbidden) لكن سنتركها رسالة الخطأ القادمة من السيرفس
        return res.status(403).json({
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
        const officerId = req.user.id; 
        const { id } = req.params;
        const { status, resolution_text } = req.body;

        if (!status) {
            throw new Error('Status field is required.');
        }

        // السيرفس بتعمل تحويل لـ lowercase وتقارن بـ ['in_progress', 'resolved']
        // هنبعتها مباشرة والسيرفس هتتولى الباقي بأمان
        const formattedStatus = status.toLowerCase();

        const data = await updateComplaintStatusService(id, formattedStatus, resolution_text, officerId);
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
        const officerId = req.user.id;
        const { category_id } = req.query; // بقت اختياري في السيرفس، لو مش مبعوتة بتجيب كله الخاص بالـ officer

        const data = await getAppealedComplaintsService(officerId, category_id);
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
// 5. Mark Appeal as Reviewed
// =========================================================
exports.markAppealReviewedController = async (req, res) => {
    try {
        const officerId = req.user.id; // تمريره لمنع التلاعب بتظلمات الكليات الأخرى
        const { id } = req.params;

        const data = await markAppealReviewedService(id, officerId);
        return res.status(200).json(data);

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// =========================================================
// 6. Get Officer Dashboard (مؤمنة بالـ Token)
// =========================================================
exports.getDashboard = async (req, res) => {
    try {
        const { category_id } = req.query; 
        
        // الأمان: الـ ID ييجي من الـ Token الموثق، ولو مش موجود (حالة الـ Testing بدون Auth Middleware) يشوف الـ Query أو الافتراضي
        const officerId = req.user?.id || req.query.officer_id || 36; 

        const stats = await getOfficerDashboardStats(officerId, category_id);
        
        // لو السيرفس رجعت خطأ عدم صلاحية الـ Category
        if (stats.error) {
            return res.status(403).json({
                success: false,
                error: stats.error
            });
        }

        return res.status(200).json({ 
            success: true, 
            data: stats 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: error.message 
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
