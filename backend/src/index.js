const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const db = require("../models");
const cors = require("cors");

const studentRoutes = require("./Student/routes/route");
const managerRoutes = require("./Manager/routes/manager.routes");
const officerRoutes = require("./Officer/routes/officer.routes");
const adminRoutes = require("./Admin/routes/admin.routes");
const authRoutes = require("./Auth/routes/auth.routes");
const superAdminRoutes = require("./SuperAdmin/routes/superAdmin.route");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/complaints", studentRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/officer", officerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/superadmin", superAdminRoutes);

const PORT = process.env.PORT || 3000;

db.sequelize
  .authenticate()
  .then(async () => {
    console.log("✅ Database Connected");

    // Create the "Other" category for every faculty that exists but does not have one yet
    // This runs silently on every startup — safe to run multiple times
    try {
      const adminService = require("./Admin/services/admin.service");
      const { sequelize } = db;
      const faculties = await sequelize.query(
        "SELECT id FROM faculties WHERE id IS NOT NULL",
        { type: sequelize.QueryTypes.SELECT },
      );
      for (const faculty of faculties) {
        await adminService.ensureOtherCategoryExists(faculty.id);
      }
      console.log("✅ Other categories verified for all faculties");
    } catch (err) {
      console.warn("⚠️  Could not ensure Other categories:", err.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Unable to connect to the database:", err.message);
  });
