const express = require('express');
const router = express.Router();

// استدعاء الكنترولر الفعلي للأوفيسر المتوافق مع اسم ملفك
const {
    getDepartmentComplaintsController,
    getComplaintDetailsController,
    updateComplaintStatusController,
    getAppealedComplaintsController,
    markAppealReviewedController,
    getDashboard
} = require('../controllers/officer.controller'); // 

// =========================================================
// =========================================================
router.get('/dashboard', getDashboard);
router.get('/complaints', getDepartmentComplaintsController);
router.get('/complaints/:id', getComplaintDetailsController);
router.patch('/complaints/:id/status', updateComplaintStatusController);
router.get('/appeals', getAppealedComplaintsController);
router.patch('/appeals/:id/review', markAppealReviewedController);

module.exports = router;