// =========================================================
// Imports (all consolidated at the top, no duplicates)
// =========================================================
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");

const db = require("../../../models");
const {
  Category,
  User,
  Student,
  Regulation,
  PriorityRules,
  AuditLog,
  CategoryKeywords,
  CategoryOfficer,
  SystemSetting,
  sequelize,
} = db;

const {
  ROLES,
  ADMIN_PROVISIONABLE_ROLES,
} = require("../../Auth/constants/roles");
const { isEmailAllowed } = require("../../Auth/helpers/emailDomain");
const { pythonService } = require("../../../config/config");

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
    createdAt: Date.now(),
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

const getConfiguredEmailDomain = async () => {
  const settings = await SystemSetting.findOne();
  return settings?.email_domain || null;
};

// Throws if the email doesn't match the configured university domain.
// Called at CREATION time now, not just at OTP signup time, so bad
// data is rejected immediately instead of discovered weeks later.
const assertDomainAllowed = async (email) => {
  const domain = await getConfiguredEmailDomain();
  if (!isEmailAllowed(email, domain)) {
    throw new Error(`Email must use the university domain (${domain}).`);
  }
};

function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}

function validateCsvRows(rows, requiredColumns) {
  if (rows.length === 0) {
    return { invalid_structure: true, missing_columns: requiredColumns };
  }

  const fileColumns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((col) => !fileColumns.includes(col));

  return {
    invalid_structure: missing.length > 0,
    missing_columns: missing,
  };
}

// =========================================================================
// CATEGORIES
// =========================================================================

// GET /api/admin/categories
exports.getAllCategories = () => {
  return Category.findAll({
    include: [
      {
        model: User,
        as: "officers",
        through: { attributes: [] },
        attributes: ["id", "full_name", "email"],
      },
    ],
  });
};

// POST /api/admin/categories - create a category with keywords and one or more officers
exports.createNewCategory = (data) => {
  return Category.create({
    name: data.name,
    description: data.description,
    sla_hours: data.sla_hours,
    faculty_id: data.faculty_id || 3, // default faculty for now
    is_active: true,
  }).then((category) => {
    const relationPromises = [];

    // Keywords - used by the chatbot for classification
    if (data.keywords && CategoryKeywords) {
      const keywordList = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      keywordList.forEach((kw) => {
        relationPromises.push(
          CategoryKeywords.create({
            category_id: category.id,
            keyword: kw,
          }).catch((err) =>
            console.error("Failed to save keyword:", err.message),
          ),
        );
      });
    }

    // Officers responsible for this category - accepts an array now,
    // falls back to a single responsible_id for backward compatibility
    const officerIds = Array.isArray(data.officer_ids)
      ? data.officer_ids
      : data.responsible_id
        ? [data.responsible_id]
        : [];

    officerIds.forEach((officer_id) => {
      relationPromises.push(
        CategoryOfficer.create({
          category_id: category.id,
          officer_id,
        }).catch((err) =>
          console.error("Failed to link officer to category:", err.message),
        ),
      );
    });

    return Promise.all(relationPromises).then(() => {
      return axios
        .post(`${pythonService.baseUrl}/api/refresh-categories`)
        .then(() => category)
        .catch((err) => {
          console.error(
            `Python sync failed for category ${category.id}:`,
            err.message,
          );
          return category;
        });
    });
  });
};

// PATCH /api/admin/categories/:id
exports.updateCategory = (id, data) => {
  return Category.update(data, { where: { id } }).then((result) => {
    return axios
      .post(`${pythonService.baseUrl}/api/refresh-categories`)
      .then(() => result)
      .catch((err) => {
        console.error(
          `Python sync failed for category update ${id}:`,
          err.message,
        );
        return result;
      });
  });
};

// DELETE /api/admin/categories/:id - soft delete
exports.softDeleteCategory = (id) => {
  return Category.update({ is_active: false }, { where: { id } });
};

// =========================================================================
// USERS (general management)
// =========================================================================

exports.getAllUsers = () => {
  return User.findAll({
    attributes: [
      "id",
      "full_name",
      "email",
      "role",
      "is_active",
      "is_also_manager",
      "manager_title",
      "officer_title",
    ],
  });
};

exports.updateUser = (id, data) => {
  return User.update(data, { where: { id } });
};

exports.softDeleteUser = (id) => {
  return User.update({ is_active: false }, { where: { id } });
};

// =========================================================================
// STUDENTS (provisioning by Admin: manual create + CSV bulk import)
// =========================================================================

exports.createStudentService = async (data, facultyId) => {
  const { student_number, full_name, email, department, academic_year } = data;

  if (!student_number || !full_name || !email) {
    throw new Error("student_number, full_name, and email are required");
  }

  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  await assertDomainAllowed(email);

  const existing = await Student.findOne({
    where: {
      [Op.or]: [{ student_number }, { email }],
    },
  });

  if (existing) {
    throw new Error(
      "A student with this student_number or email already exists",
    );
  }

  const student = await Student.create({
    student_number,
    full_name,
    email,
    department,
    academic_year,
    faculty_id: facultyId,
  });

  return { success: true, student };
};

// Import Students via CSV — Preview step
exports.importStudentsCsvService = async (filePath, facultyId) => {
  const rows = await parseCsvFile(filePath);

  const requiredColumns = ["student_number", "full_name", "email"];
  const validation = validateCsvRows(rows, requiredColumns);

  if (validation.invalid_structure) {
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );
  }

  const domain = await getConfiguredEmailDomain();

  const existingStudents = await Student.findAll({
    attributes: ["student_number", "email"],
  });

  const existingNumbers = new Set(
    existingStudents.map((s) => s.student_number),
  );
  const existingEmails = new Set(existingStudents.map((s) => s.email));

  const seenNumbersInFile = new Set();
  const seenEmailsInFile = new Set();

  const validRows = [];
  const invalidRows = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const errors = [];

    const student_number = (row.student_number || "").trim();
    const full_name = (row.full_name || "").trim();
    const email = (row.email || "").trim();
    const department = (row.department || "").trim();
    const academic_year = row.academic_year
      ? parseInt(row.academic_year, 10)
      : null;

    if (!student_number) errors.push("missing student_number");
    if (!full_name) errors.push("missing full_name");
    if (!email) errors.push("missing email");
    if (email && !isValidEmail(email)) errors.push("invalid email format");

    if (email && domain) {
      try {
        if (!isEmailAllowed(email, domain)) {
          errors.push(`email does not match university domain (${domain})`);
        }
      } catch (e) {
        errors.push("email domain check failed");
      }
    }

    if (student_number && existingNumbers.has(student_number)) {
      errors.push("student_number already exists in database");
    }
    if (email && existingEmails.has(email)) {
      errors.push("email already exists in database");
    }
    if (student_number && seenNumbersInFile.has(student_number)) {
      errors.push("duplicate student_number within file");
    }
    if (email && seenEmailsInFile.has(email)) {
      errors.push("duplicate email within file");
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
      faculty_id: facultyId,
    });
  });

  return {
    import_id: storeImportSession("student", facultyId, validRows),
    preview: {
      total_records: rows.length,
      valid_records: validRows.length,
      invalid_records: invalidRows.length,
      errors: invalidRows,
    },
  };
};

exports.confirmImportStudentsService = async (importId) => {
  const session = getImportSession(importId);

  if (!session) {
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  }
  if (session.type !== "student") {
    throw new Error("Invalid import session type");
  }

  const validRows = session.validRows;

  if (!validRows || validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
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
// Officers must be assigned at least one category at creation time.
// =========================================================================

exports.createOfficerService = async (data, facultyId) => {
  const { full_name, email, category_ids, is_also_manager, manager_title, officer_title } =
    data;

  if (!full_name || !email) {
    throw new Error("full_name and email are required");
  }
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }
  if (
    !category_ids ||
    !Array.isArray(category_ids) ||
    category_ids.length === 0
  ) {
    throw new Error("At least one category_id is required for an officer");
  }

  await assertDomainAllowed(email);

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  // Confirm every category belongs to this admin's faculty -
  // prevents accidentally assigning an officer to another faculty's category
  const validCategories = await Category.findAll({
    where: { id: category_ids, faculty_id: facultyId },
  });
  if (validCategories.length !== category_ids.length) {
    throw new Error(
      "One or more category_ids are invalid or belong to a different faculty",
    );
  }

  const officer = await User.create({
    full_name,
    email,
    role: ROLES.OFFICER,
    is_active: true,
    faculty_id: facultyId,
    is_also_manager: !!is_also_manager,
    manager_title: is_also_manager ? (manager_title || null) : null,
    officer_title: officer_title || null,
  });

  await Promise.all(
    category_ids.map((category_id) =>
      CategoryOfficer.create({
        category_id,
        officer_id: officer.id,
        assigned_at: new Date(),
        officer_type: officer_title || null,
      }),
    ),
  );

  return { success: true, officer };
};

exports.importOfficersCsvService = async (filePath, facultyId) => {
  const rows = await parseCsvFile(filePath);

  // category_ids expected as a semicolon-separated list in the CSV, e.g. "1;4;7"
  const requiredColumns = [
    "full_name",
    "email",
    "category_ids",
    "officer_title",
  ];
  const validation = validateCsvRows(rows, requiredColumns);

  if (validation.invalid_structure) {
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );
  }

  const domain = await getConfiguredEmailDomain();

  const existingUsers = await User.findAll({ attributes: ["email"] });
  const existingEmails = new Set(existingUsers.map((u) => u.email));
  const seenEmailsInFile = new Set();

  const facultyCategories = await Category.findAll({
    where: { faculty_id: facultyId },
    attributes: ["id"],
  });
  const validCategoryIds = new Set(facultyCategories.map((c) => c.id));

  const validRows = [];
  const invalidRows = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const errors = [];

    const full_name = (row.full_name || "").trim();
    const email = (row.email || "").trim();
    const officer_title = (row.officer_title || "").trim() || null;
    const rawCategoryIds = (row.category_ids || "").trim();

    if (!full_name) errors.push("missing full_name");
    if (!email) errors.push("missing email");
    if (email && !isValidEmail(email)) errors.push("invalid email format");

    if (email && domain) {
      try {
        if (!isEmailAllowed(email, domain)) {
          errors.push(`email does not match university domain (${domain})`);
        }
      } catch (e) {
        errors.push("email domain check failed");
      }
    }

    if (email && existingEmails.has(email)) {
      errors.push("email already exists in database");
    }
    if (email && seenEmailsInFile.has(email)) {
      errors.push("duplicate email within file");
    }

    let category_ids = [];
    if (!rawCategoryIds) {
      errors.push("missing category_ids");
    } else {
      category_ids = rawCategoryIds
        .split(";")
        .map((c) => parseInt(c.trim(), 10))
        .filter((n) => !isNaN(n));
      const invalidIds = category_ids.filter((id) => !validCategoryIds.has(id));
      if (invalidIds.length > 0) {
        errors.push(
          `invalid category_ids for this faculty: ${invalidIds.join(", ")}`,
        );
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
      return;
    }

    seenEmailsInFile.add(email);

    validRows.push({
      full_name,
      email,
      officer_title,
      role: ROLES.OFFICER,
      is_active: true,
      faculty_id: facultyId,
      category_ids,
    });
  });

  return {
    import_id: storeImportSession("officer", facultyId, validRows),
    preview: {
      total_records: rows.length,
      valid_records: validRows.length,
      invalid_records: invalidRows.length,
      errors: invalidRows,
    },
  };
};

exports.confirmImportOfficersService = async (importId) => {
  const session = getImportSession(importId);

  if (!session) {
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  }
  if (session.type !== "officer") {
    throw new Error("Invalid import session type");
  }

  const validRows = session.validRows;

  if (!validRows || validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
  }

  const t = await sequelize.transaction();

  try {
    const created = [];

    for (const row of validRows) {
      const { category_ids, ...userData } = row;
      const officer = await User.create(userData, { transaction: t });

      for (const category_id of category_ids) {
        await CategoryOfficer.create(
          {
            category_id,
            officer_id: officer.id,
            assigned_at: new Date(),
            officer_type: userData.officer_title || null,
          },
          { transaction: t },
        );
      }

      created.push(officer);
    }

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
// Managers are described by a free-text title (e.g. "Faculty Manager",
// "Academic Affairs Manager") rather than tied to specific categories.
// =========================================================================

exports.createManagerService = async (data, facultyId) => {
  const { full_name, email, manager_title } = data;

  if (!full_name || !email) {
    throw new Error("full_name and email are required");
  }
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }
  if (!manager_title || !manager_title.trim()) {
    throw new Error('manager_title is required, e.g. "Faculty Manager"');
  }

  await assertDomainAllowed(email);

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const manager = await User.create({
    full_name,
    email,
    role: ROLES.MANAGER,
    is_active: true,
    faculty_id: facultyId,
    manager_title: manager_title.trim(),
  });

  return { success: true, manager };
};

exports.importManagersCsvService = async (filePath, facultyId) => {
  const rows = await parseCsvFile(filePath);

  const requiredColumns = ["full_name", "email", "manager_title"];
  const validation = validateCsvRows(rows, requiredColumns);

  if (validation.invalid_structure) {
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );
  }

  const domain = await getConfiguredEmailDomain();

  const existingUsers = await User.findAll({ attributes: ["email"] });
  const existingEmails = new Set(existingUsers.map((u) => u.email));
  const seenEmailsInFile = new Set();

  const validRows = [];
  const invalidRows = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const errors = [];

    const full_name = (row.full_name || "").trim();
    const email = (row.email || "").trim();
    const manager_title = (row.manager_title || "").trim();

    if (!full_name) errors.push("missing full_name");
    if (!email) errors.push("missing email");
    if (!manager_title) errors.push("missing manager_title");
    if (email && !isValidEmail(email)) errors.push("invalid email format");

    if (email && domain) {
      try {
        if (!isEmailAllowed(email, domain)) {
          errors.push(`email does not match university domain (${domain})`);
        }
      } catch (e) {
        errors.push("email domain check failed");
      }
    }

    if (email && existingEmails.has(email)) {
      errors.push("email already exists in database");
    }
    if (email && seenEmailsInFile.has(email)) {
      errors.push("duplicate email within file");
    }

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
      return;
    }

    seenEmailsInFile.add(email);

    validRows.push({
      full_name,
      email,
      manager_title,
      role: ROLES.MANAGER,
      is_active: true,
      faculty_id: facultyId,
    });
  });

  return {
    import_id: storeImportSession("manager", facultyId, validRows),
    preview: {
      total_records: rows.length,
      valid_records: validRows.length,
      invalid_records: invalidRows.length,
      errors: invalidRows,
    },
  };
};

exports.confirmImportManagersService = async (importId) => {
  const session = getImportSession(importId);

  if (!session) {
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  }
  if (session.type !== "manager") {
    throw new Error("Invalid import session type");
  }

  const validRows = session.validRows;

  if (!validRows || validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
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
// PROMOTE OFFICER TO ALSO-MANAGER (or revoke it)
// =========================================================================

exports.setOfficerManagerFlag = async (
  officerId,
  is_also_manager,
  manager_title,
) => {
  const officer = await User.findOne({
    where: { id: officerId, role: ROLES.OFFICER },
  });

  if (!officer) {
    throw new Error("Officer not found");
  }

  await officer.update({
    is_also_manager: !!is_also_manager,
    manager_title: is_also_manager ? manager_title || null : null,
  });

  return { success: true, officer };
};

// =========================================================================
// REGULATIONS
// =========================================================================

exports.getAllRegulations = () => {
  return Regulation.findAll();
};

exports.createNewRegulation = (data) => {
  return Regulation.create({
    article_number: data["article number"],
    content: data.content,
    type: data.type,
    faculty_id: data.faculty_id || 3,
  }).then((regulation) => {
    return axios
      .post(`${pythonService.baseUrl}/api/regulations/refresh`)
      .then(() => regulation)
      .catch((err) => {
        console.error(
          `Python sync failed for regulation ${regulation.id}:`,
          err.message,
        );
        return regulation;
      });
  });
};

exports.deleteRegulation = (id) => {
  return Regulation.destroy({ where: { id } });
};

// =========================================================================
// PRIORITY RULES
// =========================================================================

exports.getPriorityRules = () => {
  return PriorityRules.findAll();
};

exports.upsertPriorityRule = (data) => {
  const priorityLevel = Number(data["priority level"]);
  const description = String(data.description || "");

  let examplesArray;
  if (Array.isArray(data.examples)) {
    examplesArray = data.examples;
  } else if (typeof data.examples === "string") {
    examplesArray = data.examples.split(",").map((e) => e.trim());
  } else {
    examplesArray = [];
  }

  const jsonExamples = JSON.stringify(examplesArray);

  return sequelize
    .query(
      `SELECT id FROM "PriorityRules" WHERE priority_level = :priorityLevel LIMIT 1`,
      {
        replacements: { priorityLevel },
        type: sequelize.QueryTypes.SELECT,
      },
    )
    .then((rows) => {
      if (rows && rows.length > 0) {
        return sequelize.query(
          `UPDATE "PriorityRules" 
                 SET description = :description, examples = :jsonExamples, "updatedAt" = NOW() 
                 WHERE priority_level = :priorityLevel`,
          {
            replacements: { description, jsonExamples, priorityLevel },
            type: sequelize.QueryTypes.UPDATE,
          },
        );
      } else {
        return sequelize.query(
          `INSERT INTO "PriorityRules" (priority_level, description, examples, "updatedAt") 
                 VALUES (:priorityLevel, :description, :jsonExamples, NOW())`,
          {
            replacements: { priorityLevel, description, jsonExamples },
            type: sequelize.QueryTypes.INSERT,
          },
        );
      }
    });
};

// =========================================================================
// AUDIT LOGS
// =========================================================================

exports.getSystemAuditLogs = (filters) => {
  let whereClause = {};

  if (filters.user_id) whereClause.user_id = filters.user_id;
  if (filters.entity_type) whereClause.entity_type = filters.entity_type;

  if (filters.from && filters.to) {
    whereClause.createdAt = {
      [Op.between]: [new Date(filters.from), new Date(filters.to)],
    };
  }

  return AuditLog.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: User,
        attributes: ["full_name"],
      },
    ],
  });
};