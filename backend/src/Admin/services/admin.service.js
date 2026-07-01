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
  sequelize,
} = db;

const {
  ROLES,
  ADMIN_PROVISIONABLE_ROLES,
} = require("../../Auth/constants/roles");
const { isEmailAllowed } = require("../../Auth/helpers/emailDomain");
const { pythonService } = require("../../../config/config");

const pendingImports = new Map();
const IMPORT_TTL_MS = 30 * 60 * 1000;

function cleanupOldImports() {
  const now = Date.now();
  for (const [key, value] of pendingImports.entries()) {
    if (now - value.createdAt > IMPORT_TTL_MS) {
      pendingImports.delete(key);
    }
  }
}

function storeImportSession(type, facultyId, role, validRows) {
  cleanupOldImports();
  const importId = crypto.randomUUID();
  pendingImports.set(importId, {
    type,
    facultyId: Number(facultyId),
    role,
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

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getConfiguredEmailDomain = async (facultyId) => {
  if (!facultyId) return null;
  try {
    const numericFacultyId = Number(facultyId);
    const [faculty] = await sequelize.query(
      `SELECT email_domain FROM faculties WHERE id = :facultyId LIMIT 1`,
      {
        replacements: { facultyId: numericFacultyId },
        type: sequelize.QueryTypes.SELECT,
      },
    );
    return faculty?.email_domain || null;
  } catch (error) {
    console.error("Error fetching domain from faculties table:", error.message);
    return null;
  }
};

const assertDomainAllowed = async (email, facultyId) => {
  const numericFacultyId = Number(facultyId);
  const domain = await getConfiguredEmailDomain(numericFacultyId);
  if (!domain) return;
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

async function generatePasswordHash(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// =========================================================================
// CATEGORIES
// =========================================================================

exports.getAllCategories = (facultyId) => {
  return Category.findAll({
    where: { faculty_id: Number(facultyId) },
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
    faculty_id: Number(data.faculty_id) || 3,
    is_active: true,
  }).then((category) => {
    const relationPromises = [];

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

exports.updateCategory = async (id, data) => {
  await Category.update(data, { where: { id } });

  if (data.keywords !== undefined) {
    await CategoryKeywords.destroy({ where: { category_id: id } });

    if (data.keywords && data.keywords.trim() !== "") {
      const keywordList = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const keywordPromises = keywordList.map((kw) => {
        return CategoryKeywords.create({
          category_id: id,
          keyword: kw,
        });
      });
      await Promise.all(keywordPromises);
    }
  }

  try {
    await axios.post(`${pythonService.baseUrl}/api/refresh-categories`);
  } catch (err) {
    console.error(`Python sync failed for category update ${id}:`, err.message);
  }

  return { success: true };
};

exports.softDeleteCategory = async (id) => {
  const result = await Category.update({ is_active: false }, { where: { id } });

  try {
    await axios.post(`${pythonService.baseUrl}/api/refresh-categories`);
  } catch (err) {
    console.error(`Python sync failed for category delete ${id}:`, err.message);
  }

  return result;
};

// =========================================================================
// UNIFIED USER PROVISIONING (Manual Creation Based on Chat Request)
// =========================================================================
exports.createUserService = async (data, facultyId) => {
  const numericFacultyId = Number(facultyId);

  const {
    role,
    full_name,
    email,
    password,
    student_number,
    department,
    academic_year,
    category_ids,
    is_also_manager,
    manager_title,
    officer_title,
  } = data;

  if (!role || !full_name || !email || !password) {
    throw new Error(
      "role, full_name, email, and password are required fields.",
    );
  }
  if (!isValidEmail(email)) throw new Error("Invalid email format.");

  await assertDomainAllowed(email, numericFacultyId);

  const userExists = await User.findOne({ where: { email } });
  const studentExists = await Student.findOne({ where: { email } });
  if (userExists || studentExists) {
    throw new Error("A user or student with this email already exists.");
  }

  const password_hash = await generatePasswordHash(password);

  if (role === ROLES.STUDENT) {
    if (!student_number)
      throw new Error("student_number is required for creating a student.");

    const numExists = await Student.findOne({
      where: { student_number: String(student_number) },
    });
    if (numExists) throw new Error("This student number already exists.");

    const student = await Student.create({
      student_number: String(student_number),
      full_name,
      email,
      department: department || null,
      academic_year: academic_year ? parseInt(academic_year, 10) : null,
      faculty_id: numericFacultyId,
    });

    await User.create({
      full_name,
      email,
      password_hash,
      role: ROLES.STUDENT,
      is_active: true,
      faculty_id: numericFacultyId,
      student_id: student.id,
    });

    return { success: true, role, data: student };
  } else if (role === ROLES.OFFICER) {
    if (
      !category_ids ||
      !Array.isArray(category_ids) ||
      category_ids.length === 0
    ) {
      throw new Error("At least one category_id is required for an officer.");
    }

    const validCategories = await Category.findAll({
      where: { id: category_ids, faculty_id: numericFacultyId },
    });
    if (validCategories.length !== category_ids.length) {
      throw new Error(
        "One or more category_ids are invalid or belong to a different faculty.",
      );
    }

    const officer = await User.create({
      full_name,
      email,
      password_hash,
      role: ROLES.OFFICER,
      is_active: true,
      faculty_id: numericFacultyId,
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

    return { success: true, role, data: officer };
  } else if (role === ROLES.MANAGER) {
    if (!manager_title || !manager_title.trim()) {
      throw new Error(
        'manager_title is required for managers, e.g. "Academic Affairs Manager"',
      );
    }

    const manager = await User.create({
      full_name,
      email,
      password_hash,
      role: ROLES.MANAGER,
      is_active: true,
      faculty_id: numericFacultyId,
      manager_title: manager_title.trim(),
    });

    return { success: true, role, data: manager };
  } else {
    throw new Error(`Unauthorized or invalid role provisioning: ${role}`);
  }
};

// =========================================================================
// UNIFIED CSV BULK IMPORT (Preview + Confirm)
// =========================================================================
exports.importUsersCsvService = async (filePath, facultyId, targetRole) => {
  const numericFacultyId = Number(facultyId);
  const rows = await parseCsvFile(filePath);
  const domain = await getConfiguredEmailDomain(numericFacultyId);

  const validRows = [];
  const invalidRows = [];
  const seenEmailsInFile = new Set();

  let requiredColumns = ["full_name", "email", "password"];
  if (targetRole === ROLES.STUDENT) requiredColumns.push("student_number");
  if (targetRole === ROLES.OFFICER) requiredColumns.push("category_ids");
  if (targetRole === ROLES.MANAGER) requiredColumns.push("manager_title");

  const validation = validateCsvRows(rows, requiredColumns);
  if (validation.invalid_structure) {
    throw new Error(
      `CSV layout is missing required headers for ${targetRole}: ${validation.missing_columns.join(", ")}`,
    );
  }

  const existingUsers = await User.findAll({ attributes: ["email"] });
  const existingStudents = await Student.findAll({
    attributes: ["email", "student_number"],
  });

  const globalEmails = new Set([
    ...existingUsers.map((u) => u.email),
    ...existingStudents.map((s) => s.email),
  ]);
  const globalStudentNumbers = new Set(
    existingStudents.map((s) => s.student_number),
  );
  const seenNumbersInFile = new Set();

  let validCategoryIds = new Set();
  if (targetRole === ROLES.OFFICER) {
    const categories = await Category.findAll({
      where: { faculty_id: numericFacultyId },
      attributes: ["id"],
    });
    validCategoryIds = new Set(categories.map((c) => c.id));
  }

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNum = index + 2;
    const errors = [];

    const full_name = (row.full_name || "").trim();
    const email = (row.email || "").trim();
    const password = (row.password || "").trim();

    if (!full_name) errors.push("missing full_name");
    if (!email) errors.push("missing email");
    if (!password) errors.push("missing default login password");
    if (email && !isValidEmail(email)) errors.push("invalid email format");

    if (email && domain && !isEmailAllowed(email, domain)) {
      errors.push(`email mapping violates domain requirement (${domain})`);
    }
    if (email && (globalEmails.has(email) || seenEmailsInFile.has(email))) {
      errors.push("email already claimed inside system or current file roster");
    }

    let cleanRowData = {
      full_name,
      email,
      password,
      role: targetRole,
      faculty_id: numericFacultyId,
    };

    if (targetRole === ROLES.STUDENT) {
      const student_number = (row.student_number || "").trim();
      if (!student_number) errors.push("missing student_number");
      if (
        student_number &&
        (globalStudentNumbers.has(student_number) ||
          seenNumbersInFile.has(student_number))
      ) {
        errors.push("duplicate student identifier number matched");
      }
      seenNumbersInFile.add(student_number);

      cleanRowData.student_number = String(student_number);
      cleanRowData.department = (row.department || "").trim() || null;
      cleanRowData.academic_year = row.academic_year
        ? parseInt(row.academic_year, 10)
        : null;
    } else if (targetRole === ROLES.OFFICER) {
      const rawCategoryIds = (row.category_ids || "").trim();
      cleanRowData.officer_title = (row.officer_title || "").trim() || null;

      if (!rawCategoryIds) {
        errors.push("missing category authorization bindings");
      } else {
        const parsedIds = rawCategoryIds
          .split(";")
          .map((c) => parseInt(c.trim(), 10))
          .filter((n) => !isNaN(n));
        const invalidIds = parsedIds.filter((id) => !validCategoryIds.has(id));
        if (invalidIds.length > 0) {
          errors.push(
            `unauthorized or out-of-bounds department categories: ${invalidIds.join(", ")}`,
          );
        }
        cleanRowData.category_ids = parsedIds;
      }
    } else if (targetRole === ROLES.MANAGER) {
      const manager_title = (row.manager_title || "").trim();
      if (!manager_title)
        errors.push("missing required operational management title");
      cleanRowData.manager_title = manager_title;
    }

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, data: row, errors });
    } else {
      seenEmailsInFile.add(email);
      validRows.push(cleanRowData);
    }
  }

  return {
    import_id: storeImportSession(
      "unified_user",
      numericFacultyId,
      targetRole,
      validRows,
    ),
    preview: {
      total_records: rows.length,
      valid_records: validRows.length,
      invalid_records: invalidRows.length,
      errors: invalidRows,
    },
  };
};

exports.confirmImportUsersService = async (importId) => {
  const session = getImportSession(importId);
  if (!session || session.type !== "unified_user") {
    throw new Error(
      "Import payload references an invalid or expired caching context.",
    );
  }

  const { validRows, role, facultyId } = session;
  if (!validRows || validRows.length === 0) {
    deleteImportSession(importId);
    throw new Error("Empty dataset. Execution stopped.");
  }

  const numericFacultyId = Number(facultyId);
  const t = await sequelize.transaction();
  try {
    const outputReceipts = [];

    for (const rowData of validRows) {
      const { password, ...meta } = rowData;
      const password_hash = await generatePasswordHash(password);

      if (role === ROLES.STUDENT) {
        const student = await Student.create(
          {
            student_number: String(meta.student_number),
            full_name: meta.full_name,
            email: meta.email,
            department: meta.department,
            academic_year: meta.academic_year,
            faculty_id: numericFacultyId,
          },
          { transaction: t },
        );

        await User.create(
          {
            full_name: meta.full_name,
            email: meta.email,
            password_hash,
            role: ROLES.STUDENT,
            is_active: true,
            faculty_id: numericFacultyId,
            student_id: student.id,
          },
          { transaction: t },
        );

        outputReceipts.push(student);
      } else if (role === ROLES.OFFICER) {
        const officer = await User.create(
          {
            full_name: meta.full_name,
            email: meta.email,
            password_hash,
            role: ROLES.OFFICER,
            is_active: true,
            faculty_id: numericFacultyId,
            officer_title: meta.officer_title,
          },
          { transaction: t },
        );

        for (const category_id of meta.category_ids) {
          await CategoryOfficer.create(
            {
              category_id,
              officer_id: officer.id,
              assigned_at: new Date(),
              officer_type: meta.officer_title,
            },
            { transaction: t },
          );
        }
        outputReceipts.push(officer);
      } else if (role === ROLES.MANAGER) {
        const manager = await User.create(
          {
            full_name: meta.full_name,
            email: meta.email,
            password_hash,
            role: ROLES.MANAGER,
            is_active: true,
            faculty_id: numericFacultyId,
            manager_title: meta.manager_title,
          },
          { transaction: t },
        );

        outputReceipts.push(manager);
      }
    }

    await t.commit();
    deleteImportSession(importId);
    return { success: true, imported_count: outputReceipts.length };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

// =========================================================================
// GENERAL ACCOUNT UPDATES & SYSTEM FUNCTIONS
// =========================================================================

exports.getAllUsers = (facultyId) => {
  return User.findAll({
    where: {
      faculty_id: Number(facultyId),
      role: { [Op.ne]: "admin" },
    },
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

exports.updateUser = async (id, data, facultyId) => {
  const user = await User.findOne({
    where: { id, faculty_id: Number(facultyId) },
  });

  if (!user) {
    throw new Error("User not found or does not belong to your faculty.");
  }

  return User.update(data, { where: { id } });
};

exports.softDeleteUser = async (id, facultyId) => {
  const user = await User.findOne({
    where: { id, faculty_id: Number(facultyId) },
  });

  if (!user) {
    throw new Error("User not found or does not belong to your faculty.");
  }

  return User.update({ is_active: false }, { where: { id } });
};

exports.setOfficerManagerFlag = async (
  officerId,
  is_also_manager,
  manager_title,
  facultyId,
) => {
  const officer = await User.findOne({
    where: {
      id: officerId,
      role: ROLES.OFFICER,
      faculty_id: Number(facultyId),
    },
  });

  if (!officer)
    throw new Error("Officer not found or does not belong to your faculty.");

  await officer.update({
    is_also_manager: !!is_also_manager,
    manager_title: is_also_manager ? manager_title || null : null,
  });

  return { success: true, officer };
};

// =========================================================================
// REGULATIONS
// Two paths: createNewRegulation (manual text entry, existing behavior) and
// savePdfRegulationChunks (called after the Python service parses a PDF —
// this is what makes the chatbot's RAG regulation search work).
// =========================================================================

exports.getAllRegulations = (facultyId) => {
  return Regulation.findAll({
    where: { faculty_id: Number(facultyId) },
  });
};

exports.deleteRegulation = async (id, facultyId) => {
  const regulation = await Regulation.findOne({
    where: { id, faculty_id: Number(facultyId) },
  });

  if (!regulation) {
    throw new Error("Regulation not found or does not belong to your faculty.");
  }

  return Regulation.destroy({ where: { id } });
};

exports.createNewRegulation = (data, facultyId) => {
  return Regulation.create({
    article_number: data["article number"],
    content: data.content,
    type: data.type,
    faculty_id: Number(facultyId),
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

// =========================================================================
// PRIORITY RULES
// =========================================================================

exports.getPriorityRules = (facultyId) => {
  return sequelize.query(
    `SELECT pr.*
     FROM "PriorityRules" pr
     JOIN categories c ON c.id = pr.category_id
     WHERE c.faculty_id = :facultyId`,
    {
      replacements: { facultyId: Number(facultyId) },
      type: sequelize.QueryTypes.SELECT,
    },
  );
};

exports.upsertPriorityRule = async (data, facultyId) => {
  const priorityLevel = Number(data["priority level"]);
  const categoryId = Number(data.category_id);
  const numericFacultyId = Number(facultyId);
  const description = String(data.description || "");

  if (!categoryId) {
    throw new Error(
      "category_id is required to scope this priority rule to your faculty.",
    );
  }

  const category = await Category.findOne({
    where: { id: categoryId, faculty_id: numericFacultyId },
  });

  if (!category) {
    throw new Error("This category does not belong to your faculty.");
  }

  let examplesArray = Array.isArray(data.examples)
    ? data.examples
    : typeof data.examples === "string"
      ? data.examples.split(",").map((e) => e.trim())
      : [];
  const jsonExamples = JSON.stringify(examplesArray);

  return sequelize
    .query(
      `SELECT id FROM "PriorityRules" WHERE priority_level = :priorityLevel AND category_id = :categoryId LIMIT 1`,
      {
        replacements: { priorityLevel, categoryId },
        type: sequelize.QueryTypes.SELECT,
      },
    )
    .then((rows) => {
      if (rows && rows.length > 0) {
        return sequelize.query(
          `UPDATE "PriorityRules"
           SET description = :description, examples = :jsonExamples, "updatedAt" = NOW()
           WHERE priority_level = :priorityLevel AND category_id = :categoryId`,
          {
            replacements: {
              description,
              jsonExamples,
              priorityLevel,
              categoryId,
            },
            type: sequelize.QueryTypes.UPDATE,
          },
        );
      } else {
        return sequelize.query(
          `INSERT INTO "PriorityRules" (priority_level, description, examples, category_id, "updatedAt")
           VALUES (:priorityLevel, :description, :jsonExamples, :categoryId, NOW())`,
          {
            replacements: {
              priorityLevel,
              description,
              jsonExamples,
              categoryId,
            },
            type: sequelize.QueryTypes.INSERT,
          },
        );
      }
    });
};

// =========================================================================
// AUDIT LOGS
// =========================================================================

exports.getSystemAuditLogs = (filters, facultyId) => {
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
        where: { faculty_id: Number(facultyId) },
      },
    ],
  });
};

// =========================================================================
// OFFENSIVE MESSAGES (chatbot guardrail log, for admin review)
// =========================================================================

exports.getOffensiveMessages = (facultyId) => {
  return sequelize.query(
    `SELECT om.id, om.user_id, u.full_name AS user_name, u.email,
            om.session_id, om.message, om.offense_count, om."createdAt"
     FROM "OffensiveMessages" om
     LEFT JOIN users u ON u.id = om.user_id
     WHERE u.faculty_id = :facultyId
     ORDER BY om."createdAt" DESC LIMIT 500`,
    {
      replacements: { facultyId: Number(facultyId) },
      type: sequelize.QueryTypes.SELECT,
    },
  );
};
