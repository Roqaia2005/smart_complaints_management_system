const { Category, User, Regulation, PriorityRules, AuditLog, CategoryKeywords, CategoryOfficer, Complaint, Appeal, sequelize } = require('../../../models');
const axios = require('axios');

// 1. GET /api/admin/categories - جلب كل الأقسام
exports.getAllCategories = () => {
    return Category.findAll();
};

// 2. POST /api/admin/categories - إنشاء قسم جديد وتوزيع الكلمات المفتاحية والمسؤولين
exports.createNewCategory = (data) => {
    return Category.create({
        name: data.name,
        description: data.description,
        sla_hours: data.sla_hours,
        faculty_id: data.faculty_id || 3, // تم إضافة هذا السطر لحل المشكلة (القيمة 3 هي القيمة الافتراضية لكلية الحاسبات)
        is_active: true
    }).then(category => {
        const relationPromises = [];

        // أ. إذا تم إرسال كلمات مفتاحية، نقوم بتقسيمها وحفظها في جدول الكلمات المفتاحية
        if (data.keywords && CategoryKeywords) {
            const keywordList = data.keywords.split(',').map(k => k.trim());
            keywordList.forEach(kw => {
                relationPromises.push(
                    CategoryKeywords.create({
                        category_id: category.id,
                        keyword: kw
                    }).catch(err => console.error("⚠️ فشل حفظ الكلمة المفتاحية:", err.message))
                );
            });
        }

        // ب. إذا تم إرسال مسؤول، نقوم بربطه في جدول الموظفين المسؤولين عن الأقسام
        if (data.responsible_id && CategoryOfficer) {
            relationPromises.push(
                CategoryOfficer.create({
                    category_id: category.id,
                    officer_id: data.responsible_id
                }).catch(err => console.error("⚠️ فشل ربط الموظف المسؤول بالقسم:", err.message))
            );
        }

        // انتظر حتى يتم حفظ جميع العلاقات بنجاح ثم أرسل إشعار للبايثون
        return Promise.all(relationPromises).then(() => {
            return axios.post('http://localhost:5000/api/refresh-categories')
                .then(() => category)
                .catch(err => {
                    console.error("⚠️ سيرفر البايثون مش قايم حالياً، بس القسم وملحقاته اتسيفوا:", err.message);
                    return category;
                });
        });
    });
};

// 3. PATCH /api/admin/categories/:id - تعديل قسم قائم + إشعار البايثون
exports.updateCategory = (id, data) => {
    return Category.update(data, { where: { id } })
        .then(result => {
            return axios.post('http://localhost:5000/api/refresh-categories')
                .then(() => result)
                .catch(err => {
                    console.error("⚠️ فشل إشعار بايثون بالتعديل:", err.message);
                    return result;
                });
        });
};

// 4. DELETE /api/admin/categories/:id - مسح فرعي (Soft Delete)
exports.softDeleteCategory = (id) => {
    return Category.update({ is_active: false }, { where: { id } });
};

// 5. GET /api/admin/users - جلب جميع المستخدمين والموظفين
exports.getAllUsers = () => {
    return User.findAll({
        attributes: ['id', 'full_name', 'email', 'role', 'is_active']
    });
};

// 6. POST /api/admin/users - إنشاء حساب موظف أو أدمن جديد
exports.createNewUser = (data) => {
    return User.create({
        full_name: data.full_name,
        email: data.email,
        password_hash: data.password, 
        role: data.role,
        is_active: true
    });
};

// 7. PATCH /api/admin/users/:id - تعديل بيانات أو دور المستخدم
exports.updateUser = (id, data) => {
    return User.update(data, { where: { id } });
};
// دالة تعديل حالة المستخدم إلى غير نشط (Soft Delete) في الـ Database
exports.softDeleteUser = (id) => {
    return User.update({ is_active: false }, { where: { id } });
};

// 8. GET /api/admin/regulations - جلب كل اللوائح والأسئلة الشائعة
exports.getAllRegulations = () => {
    return Regulation.findAll();
};

// 9. POST /api/admin/regulations - إضافة لائحة جديدة وإشعار ChromaDB (بايثون)
exports.createNewRegulation = (data) => {
    return Regulation.create({
        article_number: data["article number"], 
        content: data.content,
        type: data.type,
        faculty_id: data.faculty_id || 3 // 🔥 السطر ده هو الحل! عشان يمرر الـ ID وما يضربش Not-Null
    }).then(regulation => {
        return axios.post('http://localhost:5000/api/regulations/refresh')
            .then(() => regulation)
            .catch(err => {
                console.error("⚠️ فشل تحديث اللائحة في ChromaDB، بس اتسيفت في الداتا بيز:", err.message);
                return regulation;
            });
    });
};

// 10. DELETE /api/admin/regulations/:id - مسح لائحة نهائياً
exports.deleteRegulation = (id) => {
    return Regulation.destroy({ where: { id } });
};

// 11. GET /api/admin/priority-rules - جلب قواعد الأولوية الـ 5
exports.getPriorityRules = () => {
    return PriorityRules.findAll();
};

// 12. POST /api/admin/priority-rules - إنشاء أو تحديث قاعدة الأولوية
exports.upsertPriorityRule = (data) => {
    const priorityLevel = Number(data["priority level"]);
    const description = String(data.description || '');
    const examples = String(data.examples || '');
    const facultyId = data.faculty_id || 3; // الكلية الافتراضية

    // 1. أولاً نبحث هل القاعدة موجودة فعلاً في الداتا بيز؟
    return sequelize.query(
        `SELECT id FROM "PriorityRules" WHERE priority_level = :priorityLevel LIMIT 1`,
        {
            replacements: { priorityLevel },
            type: sequelize.QueryTypes.SELECT
        }
    ).then(rows => {
        if (rows && rows.length > 0) {
            // 2. إذا كانت موجودة، نعمل UPDATE صريح بالـ SQL
            return sequelize.query(
                `UPDATE "PriorityRules" 
                 SET description = :description, examples = :examples, updated_at = NOW() 
                 WHERE priority_level = :priorityLevel`,
                {
                    replacements: { description, examples, priorityLevel },
                    type: sequelize.QueryTypes.UPDATE
                }
            );
        } else {
            // 3. إذا لم تكن موجودة، نعمل INSERT صريح ونمرر الـ faculty_id إجباري لتجنب الـ Constraint
            return sequelize.query(
                `INSERT INTO "PriorityRules" (priority_level, description, examples, faculty_id, updated_at) 
                 VALUES (:priorityLevel, :description, :examples, :facultyId, NOW())`,
                {
                    replacements: { priorityLevel, description, examples, facultyId },
                    type: sequelize.QueryTypes.INSERT
                }
            );
        }
    });
};// 12. POST /api/admin/priority-rules - إنشاء أو تحديث قاعدة الأولوية
exports.upsertPriorityRule = (data) => {
    const priorityLevel = Number(data["priority level"]);
    const description = String(data.description || '');
    
    // تحويل الـ examples لـ Array صريح عشان الداتا بيز تقبله كـ JSON سليم
    let examplesArray;
    if (Array.isArray(data.examples)) {
        examplesArray = data.examples;
    } else if (typeof data.examples === 'string') {
        examplesArray = data.examples.split(',').map(e => e.trim());
    } else {
        examplesArray = [];
    }

    // تحويل المصفوفة لـ String بصيغة JSON جاهرة للحقن
    const jsonExamples = JSON.stringify(examplesArray);

    // 1. أولاً نبحث هل القاعدة موجودة فعلاً؟
    return sequelize.query(
        `SELECT id FROM "PriorityRules" WHERE priority_level = :priorityLevel LIMIT 1`,
        {
            replacements: { priorityLevel },
            type: sequelize.QueryTypes.SELECT
        }
    ).then(rows => {
        if (rows && rows.length > 0) {
            // 2. إذا كانت موجودة، نعمل UPDATE ونمرر الـ JSON
            return sequelize.query(
                `UPDATE "PriorityRules" 
                 SET description = :description, examples = :jsonExamples, "updatedAt" = NOW() 
                 WHERE priority_level = :priorityLevel`,
                {
                    replacements: { description, jsonExamples, priorityLevel },
                    type: sequelize.QueryTypes.UPDATE
                }
            );
        } else {
            // 3. إذا لم تكن موجودة، نعمل INSERT ونمرر الـ JSON
            return sequelize.query(
                `INSERT INTO "PriorityRules" (priority_level, description, examples, "updatedAt") 
                 VALUES (:priorityLevel, :description, :jsonExamples, NOW())`,
                {
                    replacements: { priorityLevel, description, jsonExamples },
                    type: sequelize.QueryTypes.INSERT
                }
            );
        }
    });
};
// 13. GET /api/admin/audit-logs - جلب سجلات النظام مع الفلترة والترتيب
exports.getSystemAuditLogs = (filters) => {
    let whereClause = {};
    if (filters.user_id) whereClause.user_id = filters.user_id;
    if (filters.entity_type) whereClause.entity_type = filters.entity_type;
    
    if (filters.from || filters.to) {
        const { Op } = require('sequelize');
        whereClause.createdAt = {};
        if (filters.from) {
            whereClause.createdAt[Op.gte] = new Date(filters.from);
        }
        if (filters.to) {
            whereClause.createdAt[Op.lte] = new Date(filters.to);
        }
    }

    return AuditLog.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']], 
        include: [{
            model: User,
            attributes: ['full_name']
        }]
    });
};

// 14. GET /api/admin/insights - جلب إحصائيات الأدمن
exports.getAdminInsights = async () => {
    const [
        topDepartmentsRaw,
        categoryTrendsRaw,
        totalComplaints,
        resolvedComplaints,
        totalAppeals,
        monthlyVolumeRaw
    ] = await Promise.all([
        sequelize.query(`
            SELECT s.department AS name, COUNT(comp.id)::int AS count
            FROM "Complaints" comp
            JOIN users u ON u.id = comp.user_id
            JOIN "Students" s ON s.id = u.student_id
            WHERE s.department IS NOT NULL
            GROUP BY s.department
            ORDER BY count DESC
            LIMIT 5
        `, { type: sequelize.QueryTypes.SELECT }),

        sequelize.query(`
            SELECT c.name AS category, COUNT(comp.id)::int AS count
            FROM categories c
            LEFT JOIN "Complaints" comp ON comp.category_id = c.id
            GROUP BY c.name
            ORDER BY count DESC
        `, { type: sequelize.QueryTypes.SELECT }),

        Complaint.count(),
        Complaint.count({ where: { status: 'resolved' } }),
        Appeal.count(),

        sequelize.query(`
            SELECT
                TO_CHAR("createdAt", 'YYYY-MM') AS month,
                COUNT(id)::int AS count
            FROM "Complaints"
            GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
            ORDER BY month ASC
        `, { type: sequelize.QueryTypes.SELECT })
    ]);

    const top_departments = topDepartmentsRaw.map(row => ({
        name: row.name,
        count: parseInt(row.count, 10) || 0
    }));

    const category_trends = categoryTrendsRaw.map(row => ({
        category: row.category,
        count: parseInt(row.count, 10) || 0
    }));

    const resolution_rate = totalComplaints > 0 
        ? Math.round((resolvedComplaints / totalComplaints) * 100) 
        : 0;

    const appeal_rate = totalComplaints > 0 
        ? Math.round((totalAppeals / totalComplaints) * 100) 
        : 0;

    const monthly_volume = monthlyVolumeRaw.map(row => ({
        month: row.month,
        count: parseInt(row.count, 10) || 0
    }));

    return {
        top_departments,
        category_trends,
        resolution_rate,
        appeal_rate,
        monthly_volume
    };
};