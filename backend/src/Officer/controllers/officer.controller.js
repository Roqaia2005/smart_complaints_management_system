// استدعاء ملف السيرفس الموحد وفك الدوال مباشرة
const {
    getDepartmentComplaintsService,
    getComplaintDetailsService,
    updateComplaintStatusService,
    getAppealedComplaintsService,
    markAppealReviewedService,
    getOfficerDashboardStats,
    getAllOfficersService  ,
    getAssignedCategoriesService
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

        const formattedStatus = status.toLowerCase();

        // 1. تحديث حالة الشكوى من خلال السيرفس الأساسية
        const data = await updateComplaintStatusService(id, formattedStatus, resolution_text, officerId);

        // 2. نظام الإشعارات التلقائي في حال تم حل الشكوى بنجاح
        if (formattedStatus === 'resolved') {
            try {
                // استدعاء الموديلز اللازمة للربط
                const { Notification, Complaints } = require('../../../models'); 
                
                // جلب بيانات الشكوى لمعرفة الطالب صاحب الشكوى
                const complaint = await Complaints.findByPk(id);
                
                if (complaint) {
                    // إنشاء سجل الإشعار باللغة الإنجليزية وبشكل رسمي تماماً
                    await Notification.create({
                        user_id: complaint.user_id,
                        title: 'Complaint Resolved Successfully',
                        message: `Complaint number #${id} has been resolved and closed by the specialized department.`
                    });
                    console.log(`Notification triggered successfully for user: ${complaint.user_id}`);
                }
            } catch (notifyError) {
                // حماية السيرفر: لو حصل أي مشكلة في جدول الإشعارات الكود لا يتوقف والشكوى تظل محفوظة
                console.error('Notification Error but complaint saved:', notifyError.message);
            }
        }

        // 3. إرجاع الـ response الطبيعي والسليم للفرونت إند
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
        const { category_id } = req.query;

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
        const officerId = req.user.id; 
        const { id } = req.params; 
        const { response_text } = req.body; // تغيير المسمى هنا أيضاً ليطابق الفرونت

        const data = await markAppealReviewedService(id, response_text, officerId);
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
        const officerId = req.user.id; 
        const { categoryId } = req.query;

        const stats = await getOfficerDashboardStats(officerId, categoryId);

        if (stats.error) {
            return res.status(403).json({
                success: false,
                message: stats.error
            });
        }

        return res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error in getDashboard Controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};

// =========================================================
// 7. Get All Officers
// =========================================================
exports.getAllOfficersController = async (req, res) => {
    try {
        const currentOfficerId = req.user.id;
        const facultyId = req.user.faculty_id; 

        // ✅ تصحيح: استدعاء الدالة المفكوكة مباشرة بدون اسم كائن غير موجود
        const result = await getAllOfficersService(currentOfficerId, facultyId);

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error in getAllFacultyOfficers Controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};

exports.getAssignedCategoriesController = async (req, res) => {
  try {
    const data = await getAssignedCategoriesService(req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};