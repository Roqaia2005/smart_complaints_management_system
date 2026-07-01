const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { verifyToken } = require('../../../Middlewares/auth'); // تأكدي من اسم فولدر الميدل وير والـ دالة عندكم

router.get('/', verifyToken, notificationController.getUserNotifications);

module.exports = router;