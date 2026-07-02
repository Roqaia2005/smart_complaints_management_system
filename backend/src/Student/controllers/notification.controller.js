const { Notification } = require('../../../models'); // تأكدي من عدد الـ نقاط حسب مسار الموديلز عندك

exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id; // لقط الـ ID من الـ Token بتاع الـ Login محمي

        const notifications = await Notification.findAll({
            where: { user_id: userId },
            order: [['createdAt', 'DESC']] // الأحدث فوق دايماً
        });

        return res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};