const express = require('express');
const {
    getDepartmentComplaintsController,
    getComplaintDetailsController,
    updateComplaintStatusController,
    getAppealedComplaintsController,
    markAppealReviewedController
} = require('../controllers/officer.controller');

const officerRoutes = express.Router();

officerRoutes.get('/complaints', getDepartmentComplaintsController);
officerRoutes.get('/complaints/:id', getComplaintDetailsController);
officerRoutes.patch('/complaints/:id/status', updateComplaintStatusController);
officerRoutes.get('/appeals', getAppealedComplaintsController);
officerRoutes.patch('/appeals/:id/review', markAppealReviewedController);

module.exports = officerRoutes;