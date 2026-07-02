const express = require('express');
const authenticate = require("../../Middlewares/auth");
const { isStudent } = require("../../Middlewares/authorize");
const controller = require('../controllers/studentController');
const validator = require('../middlewares/studentValidator');

const router = express.Router();

router.use(authenticate, isStudent);
// 1. إنشاء شكوى
router.post(
    '/',
    validator.validateComplaint,
    controller.submitComplaint
);

// 2. عرض شكاوى الطالب
router.get(
    '/student/:student_id',
    controller.getMyComplaints
);

// 5. عرض التصنيفات
router.get(
    '/categories',
    controller.getCategories
);

// 3. تفاصيل شكوى
router.get(
    '/:id',
    controller.getDetails
);

// 4. تقديم تظلم
router.post(
    '/:id/appeal',
    validator.validateAppeal,
    controller.submitAppeal
);

module.exports = router;