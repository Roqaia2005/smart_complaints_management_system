const dotenv = require('dotenv');
dotenv.config();   // ← لازم يبقى هنا فوراً بعد استدعاء dotenv

const express = require('express');
const db = require('../models');

const studentRoutes = require('./Student/routes/route');
const managerRoutes = require('./Manager/routes/manager.routes');
const officerRoutes = require('./Officer/routes/officer.routes');
const adminRoutes = require('./Admin/routes/admin.routes');
const authRoutes = require("./Auth/routes/auth.routes");
const superAdminRoutes = require('./SuperAdmin/routes/superAdmin.route');

const app = express();
//implement cors from cross domain
const cors = require('cors');

// Middlewares
app.use(cors({
    origin: "*",
}));
app.use(express.json());

// Routes
app.use('/api/complaints', studentRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);

// Port
const PORT = process.env.PORT || 3000;

db.sequelize.authenticate()
    .then(() => {
        console.log('✅ Database Connected');
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Unable to connect to the database:', err.message);
    });