const adminService = require('../services/adminService');

// 1. جلب الأقسام
exports.getCategories = (req, res) => {
    adminService.getAllCategories()
        .then(categories => res.status(200).json({ categories }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 2. إضافة قسم
exports.addCategory = (req, res) => {
    adminService.createNewCategory(req.body)
        .then(newCat => res.status(201).json({ success: true, category_id: newCat.id }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 3. تعديل قسم
exports.patchCategory = (req, res) => {
    adminService.updateCategory(req.params.id, req.body)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 4. حذف قسم (Soft Delete)
exports.deleteCategory = (req, res) => {
    adminService.softDeleteCategory(req.params.id)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 5. جلب المستخدمين
exports.getUsers = (req, res) => {
    adminService.getAllUsers()
        .then(users => res.status(200).json({ users }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 6. إضافة مستخدم
exports.addUser = (req, res) => {
    adminService.createNewUser(req.body)
        .then(newUser => res.status(201).json({ success: true, user_id: newUser.id }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 7. تعديل مستخدم
exports.patchUser = (req, res) => {
    adminService.updateUser(req.params.id, req.body)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// دالة مسح المستخدم مسحاً فرعياً (Soft Delete)
exports.deleteUser = (req, res) => {
    const userId = req.params.id;

    adminService.softDeleteUser(userId)
        .then(() => {
            res.status(200).json({ success: true });
        })
        .catch(err => {
            res.status(500).json({ success: false, error: err.message });
        });
};

// 8. جلب اللوائح
exports.getRegulations = (req, res) => {
    adminService.getAllRegulations()
        .then(regulations => res.status(200).json({ regulations }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 9. إضافة لائحة
exports.addRegulation = (req, res) => {
    adminService.createNewRegulation(req.body)
        .then(() => res.status(201).json({ success: true }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 10. مسح لائحة
exports.removeRegulation = (req, res) => {
    adminService.deleteRegulation(req.params.id)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 11. جلب قواعد الأولوية
exports.getRules = (req, res) => {
    adminService.getPriorityRules()
        .then(rules => res.status(200).json({ rules }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 12. حفظ أو تعديل قاعدة الأولوية
exports.savePriorityRule = (req, res) => {
    adminService.upsertPriorityRule(req.body)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 13. جلب الـ Audit Logs مع الفلاتر وتحويل الـ JSON للشكل المطلوب في الدوكيومنت
exports.getAuditLogs = (req, res) => {
    adminService.getSystemAuditLogs(req.query)
        .then(logs => {
            const formattedLogs = logs.map(log => ({
                user_name: log.User ? log.User.full_name : "System",
                action: log.action,
                entity_type: log.entity_type,
                entity_id: log.entity_id,
                created_at: log.createdAt
            }));
            res.status(200).json({ logs: formattedLogs });
        })
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 14. جلب إحصائيات لوحة التحكم للأدمن
exports.getInsights = (req, res) => {
    adminService.getAdminInsights()
        .then(insights => res.status(200).json(insights))
        .catch(err => res.status(500).json({ success: false, error: err.message }));
};