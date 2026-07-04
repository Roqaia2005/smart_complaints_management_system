const express = require('express');
const authenticate = require("../../Middlewares/auth");
const { isOfficer } = require("../../Middlewares/authorize");

const router = express.Router();
router.use(authenticate, isOfficer);

const {
    getDepartmentComplaintsController,
    getComplaintDetailsController,
    updateComplaintStatusController,
    getAppealedComplaintsController,
    markAppealReviewedController,
    getDashboard,
    getAllOfficersController,
    getAssignedCategoriesController,
    escalateComplaintController,
    getOfficerCategoriesController
} = require('../controllers/officer.controller'); 

router.get('/all', getAllOfficersController);

router.get('/dashboard', getDashboard);
router.get('/complaints/details/:id', getComplaintDetailsController); 
router.get('/complaints', getDepartmentComplaintsController);
router.patch('/complaints/:id/status', updateComplaintStatusController);
router.get('/appeals', getAppealedComplaintsController);
router.patch('/appeals/:id/review', markAppealReviewedController);
router.get('/categories', getAssignedCategoriesController);
router.get(
  "/categories/by-priority", 
 getOfficerCategoriesController
);
router.post('/complaints/:id/escalate', escalateComplaintController);
module.exports = router;