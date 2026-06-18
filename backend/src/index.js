const express = require('express');
const dotenv = require('dotenv');

const db = require('../models');


const studentRoutes = require('./Student/routes/route');
const managerRoutes = require('./Manager/routes/manager.routes');
const officerRoutes = require('./Officer/routes/officer.routes');
const adminRoutes = require('./Admin/routes/adminRoutes');
const authRoutes= require("./Auth/routes/auth.routes");
const superAdminRoutes= require('./SuperAdmin/routes/superAdmin.route')

const app = express();

// قراءة ملف .env
dotenv.config();

// Middlewares
app.use(express.json());

// Routes
app.use('/api/complaints', studentRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/auth",authRoutes);
app.use("/api/super-admin",superAdminRoutes)
// Port
const PORT = process.env.PORT || 3000;

// تشغيل السيرفر بعد التأكد من اتصال الداتا بيز
db.sequelize.authenticate()
    .then(() => {

        console.log('✅ Database Connected');

        app.listen(PORT, () => {
            console.log(
                `🚀 Server is running on http://localhost:${PORT}`
            );
        });

    })
    .catch((err) => {

        console.error(
            '❌ Unable to connect to the database:',
            err.message
        );

    });