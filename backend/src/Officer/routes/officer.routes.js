const express = require('express');
const router = express.Router();

const {
    getDepartmentComplaintsController,
    getComplaintDetailsController,
    updateComplaintStatusController,
    getAppealedComplaintsController,
    markAppealReviewedController,
    getDashboard
} = require('../controllers/officer.controller'); 

router.get('/dashboard', getDashboard);
router.get('/complaints/details/:id', getComplaintDetailsController); 
router.get('/complaints', getDepartmentComplaintsController);
router.patch('/complaints/:id/status', updateComplaintStatusController);
router.get('/appeals', getAppealedComplaintsController);
router.patch('/appeals/:id/review', markAppealReviewedController);

module.exports = router;