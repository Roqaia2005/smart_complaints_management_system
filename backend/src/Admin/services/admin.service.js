const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const axios = require("axios");
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

const { ROLES } = require("../../Auth/constants/roles");
const { isEmailAllowed } = require("../../Auth/helpers/emailDomain");
const { pythonService } = require("../../../config/config");

const pendingImports = new Map();
const IMPORT_TTL_MS = 30 * 60 * 1000;

function cleanupOldImports() {
  const now = Date.now();
  for (const [key, value] of pendingImports.entries()) {
    if (now - value.createdAt > IMPORT_TTL_MS) pendingImports.delete(key);
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

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getConfiguredEmailDomain = async () => {
  const settings = await SystemSetting.findOne();
  return settings?.email_domain || null;
};

const assertDomainAllowed = async (email) => {
  const domain = await getConfiguredEmailDomain();
  if (!isEmailAllowed(email, domain))
    throw new Error(`Email must use the university domain (${domain}).`);
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
  if (rows.length === 0)
    return { invalid_structure: true, missing_columns: requiredColumns };
  const fileColumns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((col) => !fileColumns.includes(col));
  return { invalid_structure: missing.length > 0, missing_columns: missing };
}

// CATEGORIES

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

exports.createNewCategory = (data) => {
  return Category.create({
    name: data.name,
    description: data.description,
    sla_hours: data.sla_hours,
    faculty_id: data.faculty_id || 3,
    is_active: true,
  }).then((category) => {
    const promises = [];
    if (data.keywords && CategoryKeywords) {
      data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .forEach((kw) => {
          promises.push(
            CategoryKeywords.create({
              category_id: category.id,
              keyword: kw,
            }).catch((err) =>
              console.error("Failed to save keyword:", err.message),
            ),
          );
        });
    }
    const officerIds = Array.isArray(data.officer_ids)
      ? data.officer_ids
      : data.responsible_id
        ? [data.responsible_id]
        : [];
    officerIds.forEach((officer_id) => {
      promises.push(
        CategoryOfficer.create({ category_id: category.id, officer_id }).catch(
          (err) => console.error("Failed to link officer:", err.message),
        ),
      );
    });
    return Promise.all(promises).then(() =>
      axios
        .post(`${pythonService.baseUrl}/api/refresh-categories`)
        .then(() => category)
        .catch((err) => {
          console.error("Python sync failed:", err.message);
          return category;
        }),
    );
  });
};

exports.updateCategory = (id, data) => {
  return Category.update(data, { where: { id } }).then((result) =>
    axios
      .post(`${pythonService.baseUrl}/api/refresh-categories`)
      .then(() => result)
      .catch((err) => {
        console.error("Python sync failed:", err.message);
        return result;
      }),
  );
};

exports.softDeleteCategory = (id) =>
  Category.update({ is_active: false }, { where: { id } });

// USERS

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

exports.updateUser = (id, data) => User.update(data, { where: { id } });
exports.softDeleteUser = (id) =>
  User.update({ is_active: false }, { where: { id } });

// STUDENTS

exports.createStudentService = async (data, facultyId) => {
  const { student_number, full_name, email, department, academic_year } = data;
  if (!student_number || !full_name || !email)
    throw new Error("student_number, full_name, and email are required");
  if (!isValidEmail(email)) throw new Error("Invalid email format");
  await assertDomainAllowed(email);
  const existing = await Student.findOne({
    where: { [Op.or]: [{ student_number }, { email }] },
  });
  if (existing)
    throw new Error(
      "A student with this student_number or email already exists",
    );
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

exports.importStudentsCsvService = async (filePath, facultyId) => {
  const rows = await parseCsvFile(filePath);
  const validation = validateCsvRows(rows, [
    "student_number",
    "full_name",
    "email",
  ]);
  if (validation.invalid_structure)
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );

  const domain = await getConfiguredEmailDomain();
  const existing = await Student.findAll({
    attributes: ["student_number", "email"],
  });
  const existingNumbers = new Set(existing.map((s) => s.student_number));
  const existingEmails = new Set(existing.map((s) => s.email));
  const seenNumbers = new Set();
  const seenEmails = new Set();
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
        if (!isEmailAllowed(email, domain))
          errors.push("email does not match university domain");
      } catch {
        errors.push("email domain check failed");
      }
    }
    if (student_number && existingNumbers.has(student_number))
      errors.push("student_number already exists");
    if (email && existingEmails.has(email)) errors.push("email already exists");
    if (student_number && seenNumbers.has(student_number))
      errors.push("duplicate student_number in file");
    if (email && seenEmails.has(email)) errors.push("duplicate email in file");

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
      return;
    }
    seenNumbers.add(student_number);
    seenEmails.add(email);
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
  if (!session)
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  if (session.type !== "student")
    throw new Error("Invalid import session type");
  if (!session.validRows || session.validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
  }
  const t = await sequelize.transaction();
  try {
    const created = await Student.bulkCreate(session.validRows, {
      transaction: t,
    });
    await t.commit();
    deleteImportSession(importId);
    return { success: true, imported_count: created.length };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

// STUDENT INFO UPDATE (department + academic_year for existing students)

exports.importStudentInfoCsvService = async (filePath, facultyId) => {
  const rows = await parseCsvFile(filePath);
  const validation = validateCsvRows(rows, ["student_number", "full_name"]);
  if (validation.invalid_structure)
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );

  const validRows = [];
  const invalidRows = [];
  const notFoundRows = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNum = index + 2;
    const errors = [];
    const student_number = (row.student_number || "").trim();
    const full_name = (row.full_name || "").trim();
    const department = (row.department || "").trim() || null;
    const academic_year = row.academic_year
      ? parseInt(row.academic_year, 10)
      : null;

    if (!student_number) errors.push("missing student_number");
    if (!full_name) errors.push("missing full_name");

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
      continue;
    }

    const student = await Student.findOne({
      where: { student_number, faculty_id: facultyId },
    });
    if (!student) {
      notFoundRows.push({
        row: rowNum,
        student_number,
        reason: "student not found in this faculty",
      });
      continue;
    }
    validRows.push({ id: student.id, full_name, department, academic_year });
  }

  return {
    import_id: storeImportSession("student_info", facultyId, validRows),
    preview: {
      total_records: rows.length,
      valid_records: validRows.length,
      invalid_records: invalidRows.length + notFoundRows.length,
      errors: [...invalidRows, ...notFoundRows],
    },
  };
};

exports.confirmImportStudentInfoService = async (importId) => {
  const session = getImportSession(importId);
  if (!session)
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  if (session.type !== "student_info")
    throw new Error("Invalid import session type");
  if (!session.validRows || session.validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
  }
  const t = await sequelize.transaction();
  try {
    let updated = 0;
    for (const row of session.validRows) {
      const { id, ...updateData } = row;
      await Student.update(updateData, { where: { id }, transaction: t });
      updated++;
    }
    await t.commit();
    deleteImportSession(importId);
    return { success: true, updated_count: updated };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

// OFFICERS

exports.createOfficerService = async (data, facultyId) => {
  const {
    full_name,
    email,
    category_ids,
    is_also_manager,
    manager_title,
    officer_title,
  } = data;
  if (!full_name || !email) throw new Error("full_name and email are required");
  if (!isValidEmail(email)) throw new Error("Invalid email format");
  if (
    !category_ids ||
    !Array.isArray(category_ids) ||
    category_ids.length === 0
  )
    throw new Error("At least one category_id is required for an officer");
  await assertDomainAllowed(email);
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");
  const validCategories = await Category.findAll({
    where: { id: category_ids, faculty_id: facultyId },
  });
  if (validCategories.length !== category_ids.length)
    throw new Error(
      "One or more category_ids are invalid or belong to a different faculty",
    );
  const officer = await User.create({
    full_name,
    email,
    role: ROLES.OFFICER,
    is_active: true,
    faculty_id: facultyId,
    is_also_manager: !!is_also_manager,
    manager_title: is_also_manager ? manager_title || null : null,
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
  return { success: true, officer, assigned_categories: category_ids };
};

exports.importOfficersCsvService = async (filePath, facultyId) => {
  const rows = await parseCsvFile(filePath);
  const validation = validateCsvRows(rows, [
    "full_name",
    "email",
    "category_ids",
    "officer_title",
  ]);
  if (validation.invalid_structure)
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );

  const domain = await getConfiguredEmailDomain();
  const existingUsers = await User.findAll({ attributes: ["email"] });
  const existingEmails = new Set(existingUsers.map((u) => u.email));
  const seenEmails = new Set();
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
        if (!isEmailAllowed(email, domain))
          errors.push("email does not match university domain");
      } catch {
        errors.push("email domain check failed");
      }
    }
    if (email && existingEmails.has(email)) errors.push("email already exists");
    if (email && seenEmails.has(email)) errors.push("duplicate email in file");

    let category_ids = [];
    if (!rawCategoryIds) {
      errors.push("missing category_ids");
    } else {
      category_ids = rawCategoryIds
        .split(";")
        .map((c) => parseInt(c.trim(), 10))
        .filter((n) => !isNaN(n));
      const invalidIds = category_ids.filter((id) => !validCategoryIds.has(id));
      if (invalidIds.length > 0)
        errors.push(`invalid category_ids: ${invalidIds.join(", ")}`);
    }

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
      return;
    }
    seenEmails.add(email);
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
  if (!session)
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  if (session.type !== "officer")
    throw new Error("Invalid import session type");
  if (!session.validRows || session.validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
  }
  const t = await sequelize.transaction();
  try {
    const created = [];
    for (const row of session.validRows) {
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

// MANAGERS

exports.createManagerService = async (data, facultyId) => {
  const { full_name, email, manager_title } = data;
  if (!full_name || !email) throw new Error("full_name and email are required");
  if (!isValidEmail(email)) throw new Error("Invalid email format");
  if (!manager_title || !manager_title.trim())
    throw new Error("manager_title is required");
  await assertDomainAllowed(email);
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");
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
  const validation = validateCsvRows(rows, [
    "full_name",
    "email",
    "manager_title",
  ]);
  if (validation.invalid_structure)
    throw new Error(
      `CSV is missing required columns: ${validation.missing_columns.join(", ")}`,
    );

  const domain = await getConfiguredEmailDomain();
  const existingUsers = await User.findAll({ attributes: ["email"] });
  const existingEmails = new Set(existingUsers.map((u) => u.email));
  const seenEmails = new Set();
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
        if (!isEmailAllowed(email, domain))
          errors.push("email does not match university domain");
      } catch {
        errors.push("email domain check failed");
      }
    }
    if (email && existingEmails.has(email)) errors.push("email already exists");
    if (email && seenEmails.has(email)) errors.push("duplicate email in file");

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
      return;
    }
    seenEmails.add(email);
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
  if (!session)
    throw new Error(
      "Import session not found or expired. Please re-upload the file.",
    );
  if (session.type !== "manager")
    throw new Error("Invalid import session type");
  if (!session.validRows || session.validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("No valid rows to import");
  }
  const t = await sequelize.transaction();
  try {
    const created = await User.bulkCreate(session.validRows, {
      transaction: t,
    });
    await t.commit();
    deleteImportSession(importId);
    return { success: true, imported_count: created.length };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

exports.setOfficerManagerFlag = async (
  officerId,
  is_also_manager,
  manager_title,
) => {
  const officer = await User.findOne({
    where: { id: officerId, role: ROLES.OFFICER },
  });
  if (!officer) throw new Error("Officer not found");
  await officer.update({
    is_also_manager: !!is_also_manager,
    manager_title: is_also_manager ? manager_title || null : null,
  });
  return { success: true, officer };
};

// REGULATIONS

exports.getAllRegulations = () => Regulation.findAll();

exports.createNewRegulation = (data) => {
  return Regulation.create({
    article_number: data["article number"],
    content: data.content,
    type: data.type,
    faculty_id: data.faculty_id || 3,
  }).then((regulation) =>
    axios
      .post(`${pythonService.baseUrl}/api/regulations/refresh`)
      .then(() => regulation)
      .catch((err) => {
        console.error("Python sync failed:", err.message);
        return regulation;
      }),
  );
};

exports.deleteRegulation = (id) => Regulation.destroy({ where: { id } });

// PRIORITY RULES

exports.getPriorityRules = () => PriorityRules.findAll();

exports.upsertPriorityRule = (data) => {
  const priorityLevel = Number(data["priority level"]);
  const description = String(data.description || "");
  let examplesArray = Array.isArray(data.examples)
    ? data.examples
    : typeof data.examples === "string"
      ? data.examples.split(",").map((e) => e.trim())
      : [];
  const jsonExamples = JSON.stringify(examplesArray);
  return sequelize
    .query(
      `SELECT id FROM "PriorityRules" WHERE priority_level = :priorityLevel LIMIT 1`,
      { replacements: { priorityLevel }, type: sequelize.QueryTypes.SELECT },
    )
    .then((rows) => {
      if (rows && rows.length > 0) {
        return sequelize.query(
          `UPDATE "PriorityRules" SET description = :description, examples = :jsonExamples, "updatedAt" = NOW() WHERE priority_level = :priorityLevel`,
          {
            replacements: { description, jsonExamples, priorityLevel },
            type: sequelize.QueryTypes.UPDATE,
          },
        );
      }
      return sequelize.query(
        `INSERT INTO "PriorityRules" (priority_level, description, examples, "updatedAt") VALUES (:priorityLevel, :description, :jsonExamples, NOW())`,
        {
          replacements: { priorityLevel, description, jsonExamples },
          type: sequelize.QueryTypes.INSERT,
        },
      );
    });
};

// AUDIT LOGS

exports.getSystemAuditLogs = (filters) => {
  let whereClause = {};
  if (filters.user_id) whereClause.user_id = filters.user_id;
  if (filters.entity_type) whereClause.entity_type = filters.entity_type;
  if (filters.from && filters.to)
    whereClause.createdAt = {
      [Op.between]: [new Date(filters.from), new Date(filters.to)],
    };
  return AuditLog.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    include: [{ model: User, attributes: ["full_name"] }],
  });
};

// OFFENSIVE MESSAGES

exports.getOffensiveMessages = () => {
  return sequelize.query(
    `SELECT om.id, om.user_id, u.full_name AS user_name, u.email,
            om.session_id, om.message, om.offense_count, om."createdAt"
     FROM "OffensiveMessages" om
     LEFT JOIN users u ON u.id = om.user_id
     ORDER BY om."createdAt" DESC LIMIT 500`,
    { type: sequelize.QueryTypes.SELECT },
  );
};
