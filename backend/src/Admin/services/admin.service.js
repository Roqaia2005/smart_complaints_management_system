// =========================================================
// Imports (all consolidated at the top, no duplicates)
// =========================================================
const fs = require('fs');
const crypto = require('crypto');
const csv = require('csv-parser');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const db = require('../../../models');
const {
    Category,
    User,
    Student,
    Regulation,
    PriorityRules,
    AuditLog,
    CategoryKeywords,
    CategoryOfficer,
    sequelize
} = db;

const { ROLES, ADMIN_PROVISIONABLE_ROLES } = require('../../Auth/constants/roles');

// =========================================================
// In-memory storage for pending CSV imports (preview -> confirm)
// Key: import_id, Value: { type, facultyId, validRows, createdAt }
// NOTE: this resets if the server restarts. Good enough for this
// project's scale; could be moved to Redis/DB later if needed.
// =========================================================
const pendingImports = new Map();

const IMPORT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupOldImports() {
    const now = Date.now();
    for (const [key, value] of pendingImports.entries()) {
        if (now - value.createdAt > IMPORT_TTL_MS) {
            pendingImports.delete(key);
        }
    }
}

function storeImportSession(type, facultyId, validRows) {
    cleanupOldImports();
    const importId = crypto.randomUUID();
    pendingImports.set(importId, {
        type,
        facultyId,
        validRows,
        createdAt: Date.now()
    });
    return importId;
}

function getImportSession(importId) {
    return pendingImports.get(importId) || null;
}

function deleteImportSession(importId) {
    pendingImports.delete(importId);
}

// =========================================================
// Shared helpers
// =========================================================

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

function parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

function validateCsvRows(rows, requiredColumns) {
    if (rows.length === 0) {
        return { invalid_structure: true, missing_columns: requiredColumns };
    }

    const fileColumns = Object.keys(rows[0]);
    const missing = requiredColumns.filter(col => !fileColumns.includes(col));

    return {
        invalid_structure: missing.length > 0,
        missing_columns: missing
    };
}

// =========================================================================
// CATEGORIES
// =========================================================================

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
        faculty_id: data.faculty_id || 3, // القيمة الافتراضية لكلية الحاسبات
        is_active: true
    }).then(category => {
        const relationPromises = [];

        // أ. كلمات مفتاحية
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

        // ب. مسؤول القسم
        if (data.responsible_id && CategoryOfficer) {
            relationPromises.push(
                CategoryOfficer.create({
                    category_id: category.id,
                    officer_id: data.responsible_id
                }).catch(err => console.error("⚠️ فشل ربط الموظف المسؤول بالقسم:", err.message))
            );
        }

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

// =========================================================================
// USERS (general management)
// =========================================================================

// 5. GET /api/admin/users - جلب جميع المستخدمين والموظفين
exports.getAllUsers = () => {
    return User.findAll({
        attributes: ['id', 'full_name', 'email', 'role', 'is_active']
    });
};

// 7. PATCH /api/admin/users/:id - تعديل بيانات أو دور المستخدم
exports.updateUser = (id, data) => {
    return User.update(data, { where: { id } });
};

// مسح فرعي (Soft Delete) للمستخدم
exports.softDeleteUser = (id) => {
    return User.update({ is_active: false }, { where: { id } });
};

// =========================================================================
// STUDENTS (provisioning by Admin: manual create + CSV bulk import)
// =========================================================================

// Create Student (single, manual)
exports.createStudentService = async (data, facultyId) => {

    const {
        student_number,
        full_name,
        email,
        department,
        academic_year
    } = data;

    if (!student_number || !full_name || !email) {
        throw new Error('student_number, full_name, and email are required');
    }

    if (!isValidEmail(email)) {
        throw new Error('Invalid email format');
    }

    const existing = await Student.findOne({
        where: {
            [Op.or]: [
                { student_number },
                { email }
            ]
        }
    });

    if (existing) {
        throw new Error('A student with this student_number or email already exists');
    }

    const student = await Student.create({
        student_number,
        full_name,
        email,
        department,
        academic_year,
        faculty_id: facultyId
    });

    return { success: true, student };
};

// Import Students via CSV — Preview step
// Expected columns: student_number, full_name, email, department, academic_year
exports.importStudentsCsvService = async (filePath, facultyId) => {

    const rows = await parseCsvFile(filePath);

    const requiredColumns = ['student_number', 'full_name', 'email'];
    const validation = validateCsvRows(rows, requiredColumns);

    if (validation.invalid_structure) {
        throw new Error(
            `CSV is missing required columns: ${validation.missing_columns.join(', ')}`
        );
    }

    const existingStudents = await Student.findAll({
        attributes: ['student_number', 'email']
    });

    const existingNumbers = new Set(existingStudents.map(s => s.student_number));
    const existingEmails = new Set(existingStudents.map(s => s.email));

    const seenNumbersInFile = new Set();
    const seenEmailsInFile = new Set();

    const validRows = [];
    const invalidRows = [];

    rows.forEach((row, index) => {

        const rowNum = index + 2;
        const errors = [];

        const student_number = (row.student_number || '').trim();
        const full_name = (row.full_name || '').trim();
        const email = (row.email || '').trim();
        const department = (row.department || '').trim();
        const academic_year = row.academic_year ? parseInt(row.academic_year, 10) : null;

        if (!student_number) errors.push('missing student_number');
        if (!full_name) errors.push('missing full_name');
        if (!email) errors.push('missing email');
        if (email && !isValidEmail(email)) errors.push('invalid email format');

        if (student_number && existingNumbers.has(student_number)) {
            errors.push('student_number already exists in database');
        }
        if (email && existingEmails.has(email)) {
            errors.push('email already exists in database');
        }
        if (student_number && seenNumbersInFile.has(student_number)) {
            errors.push('duplicate student_number within file');
        }
        if (email && seenEmailsInFile.has(email)) {
            errors.push('duplicate email within file');
        }

        if (errors.length > 0) {
            invalidRows.push({ row: rowNum, data: row, errors });
            return;
        }

        seenNumbersInFile.add(student_number);
        seenEmailsInFile.add(email);

        validRows.push({
            student_number,
            full_name,
            email,
            department: department || null,
            academic_year: academic_year || null,
            faculty_id: facultyId
        });
    });

    return {
        import_id: storeImportSession('student', facultyId, validRows),
        preview: {
            total_records: rows.length,
            valid_records: validRows.length,
            invalid_records: invalidRows.length,
            errors: invalidRows
        }
    };
};

// Confirm Student Import — actually inserts the valid rows
exports.confirmImportStudentsService = async (importId) => {

    const session = getImportSession(importId);

    if (!session) {
        throw new Error('Import session not found or expired. Please re-upload the file.');
    }
    if (session.type !== 'student') {
        throw new Error('Invalid import session type');
    }

    const validRows = session.validRows;

    if (!validRows || validRows.length === 0) {
        deleteImportSession(importId);
        throw new Error('No valid rows to import');
    }

    const t = await sequelize.transaction();

    try {
        const created = await Student.bulkCreate(validRows, { transaction: t });
        await t.commit();
        deleteImportSession(importId);

        return { success: true, imported_count: created.length };

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// =========================================================================
// OFFICERS (provisioning by Admin: manual create + CSV bulk import)
// =========================================================================

exports.createOfficerService = async (data, facultyId) => {

    const { full_name, email } = data;

    if (!full_name || !email) {
        throw new Error('full_name and email are required');
    }
    if (!isValidEmail(email)) {
        throw new Error('Invalid email format');
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
        throw new Error('A user with this email already exists');
    }

    const officer = await User.create({
        full_name,
        email,
        role: ROLES.OFFICER,
        is_active: true,
        faculty_id: facultyId
        // password_hash stays null until the officer registers
    });

    return { success: true, officer };
};

exports.importOfficersCsvService = async (filePath, facultyId) => {

    const rows = await parseCsvFile(filePath);

    const requiredColumns = ['full_name', 'email'];
    const validation = validateCsvRows(rows, requiredColumns);

    if (validation.invalid_structure) {
        throw new Error(
            `CSV is missing required columns: ${validation.missing_columns.join(', ')}`
        );
    }

    const existingUsers = await User.findAll({ attributes: ['email'] });
    const existingEmails = new Set(existingUsers.map(u => u.email));
    const seenEmailsInFile = new Set();

    const validRows = [];
    const invalidRows = [];

    rows.forEach((row, index) => {

        const rowNum = index + 2;
        const errors = [];

        const full_name = (row.full_name || '').trim();
        const email = (row.email || '').trim();

        if (!full_name) errors.push('missing full_name');
        if (!email) errors.push('missing email');
        if (email && !isValidEmail(email)) errors.push('invalid email format');

        if (email && existingEmails.has(email)) {
            errors.push('email already exists in database');
        }
        if (email && seenEmailsInFile.has(email)) {
            errors.push('duplicate email within file');
        }

        if (errors.length > 0) {
            invalidRows.push({ row: rowNum, data: row, errors });
            return;
        }

        seenEmailsInFile.add(email);

        validRows.push({
            full_name,
            email,
            role: ROLES.OFFICER,
            is_active: true,
            faculty_id: facultyId
        });
    });

    return {
        import_id: storeImportSession('officer', facultyId, validRows),
        preview: {
            total_records: rows.length,
            valid_records: validRows.length,
            invalid_records: invalidRows.length,
            errors: invalidRows
        }
    };
};

exports.confirmImportOfficersService = async (importId) => {

    const session = getImportSession(importId);

    if (!session) {
        throw new Error('Import session not found or expired. Please re-upload the file.');
    }
    if (session.type !== 'officer') {
        throw new Error('Invalid import session type');
    }

    const validRows = session.validRows;

    if (!validRows || validRows.length === 0) {
        deleteImportSession(importId);
        throw new Error('No valid rows to import');
    }

    const t = await sequelize.transaction();

    try {
        const created = await User.bulkCreate(validRows, { transaction: t });
        await t.commit();
        deleteImportSession(importId);

        return { success: true, imported_count: created.length };

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// =========================================================================
// MANAGERS (provisioning by Admin: manual create + CSV bulk import)
// =========================================================================

exports.createManagerService = async (data, facultyId) => {

    const { full_name, email } = data;

    if (!full_name || !email) {
        throw new Error('full_name and email are required');
    }
    if (!isValidEmail(email)) {
        throw new Error('Invalid email format');
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
        throw new Error('A user with this email already exists');
    }

    const manager = await User.create({
        full_name,
        email,
        role: ROLES.MANAGER,
        is_active: true,
        faculty_id: facultyId
    });

    return { success: true, manager };
};

exports.importManagersCsvService = async (filePath, facultyId) => {

    const rows = await parseCsvFile(filePath);

    const requiredColumns = ['full_name', 'email'];
    const validation = validateCsvRows(rows, requiredColumns);

    if (validation.invalid_structure) {
        throw new Error(
            `CSV is missing required columns: ${validation.missing_columns.join(', ')}`
        );
    }

    const existingUsers = await User.findAll({ attributes: ['email'] });
    const existingEmails = new Set(existingUsers.map(u => u.email));
    const seenEmailsInFile = new Set();

    const validRows = [];
    const invalidRows = [];

    rows.forEach((row, index) => {

        const rowNum = index + 2;
        const errors = [];

        const full_name = (row.full_name || '').trim();
        const email = (row.email || '').trim();

        if (!full_name) errors.push('missing full_name');
        if (!email) errors.push('missing email');
        if (email && !isValidEmail(email)) errors.push('invalid email format');

        if (email && existingEmails.has(email)) {
            errors.push('email already exists in database');
        }
        if (email && seenEmailsInFile.has(email)) {
            errors.push('duplicate email within file');
        }

        if (errors.length > 0) {
            invalidRows.push({ row: rowNum, data: row, errors });
            return;
        }

        seenEmailsInFile.add(email);

        validRows.push({
            full_name,
            email,
            role: ROLES.MANAGER,
            is_active: true,
            faculty_id: facultyId
        });
    });

    return {
        import_id: storeImportSession('manager', facultyId, validRows),
        preview: {
            total_records: rows.length,
            valid_records: validRows.length,
            invalid_records: invalidRows.length,
            errors: invalidRows
        }
    };
};

exports.confirmImportManagersService = async (importId) => {

    const session = getImportSession(importId);

    if (!session) {
        throw new Error('Import session not found or expired. Please re-upload the file.');
    }
    if (session.type !== 'manager') {
        throw new Error('Invalid import session type');
    }

    const validRows = session.validRows;

    if (!validRows || validRows.length === 0) {
        deleteImportSession(importId);
        throw new Error('No valid rows to import');
    }

    const t = await sequelize.transaction();

    try {
        const created = await User.bulkCreate(validRows, { transaction: t });
        await t.commit();
        deleteImportSession(importId);

        return { success: true, imported_count: created.length };

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// =========================================================================
// REGULATIONS
// =========================================================================

// 8. GET /api/admin/regulations - جلب كل اللوائح
exports.getAllRegulations = () => {
    return Regulation.findAll();
};

// 9. POST /api/admin/regulations - إضافة لائحة جديدة وإشعار ChromaDB (بايثون)
exports.createNewRegulation = (data) => {
    return Regulation.create({
        article_number: data["article number"],
        content: data.content,
        type: data.type,
        faculty_id: data.faculty_id || 3
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

// =========================================================================
// PRIORITY RULES
// =========================================================================

// 11. GET /api/admin/priority-rules - جلب قواعد الأولوية
exports.getPriorityRules = () => {
    return PriorityRules.findAll();
};

// 12. POST /api/admin/priority-rules - إنشاء أو تحديث قاعدة الأولوية
// (kept the improved version: examples stored as a proper JSON array)
exports.upsertPriorityRule = (data) => {
    const priorityLevel = Number(data["priority level"]);
    const description = String(data.description || '');

    let examplesArray;
    if (Array.isArray(data.examples)) {
        examplesArray = data.examples;
    } else if (typeof data.examples === 'string') {
        examplesArray = data.examples.split(',').map(e => e.trim());
    } else {
        examplesArray = [];
    }

    const jsonExamples = JSON.stringify(examplesArray);

    return sequelize.query(
        `SELECT id FROM "PriorityRules" WHERE priority_level = :priorityLevel LIMIT 1`,
        {
            replacements: { priorityLevel },
            type: sequelize.QueryTypes.SELECT
        }
    ).then(rows => {
        if (rows && rows.length > 0) {
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

// =========================================================================
// AUDIT LOGS
// =========================================================================

// 13. GET /api/admin/audit-logs - جلب سجلات النظام مع الفلترة والترتيب
exports.getSystemAuditLogs = (filters) => {
    let whereClause = {};

    if (filters.user_id) whereClause.user_id = filters.user_id;
    if (filters.entity_type) whereClause.entity_type = filters.entity_type;

    if (filters.from && filters.to) {
        whereClause.createdAt = {
            [Op.between]: [new Date(filters.from), new Date(filters.to)]
        };
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