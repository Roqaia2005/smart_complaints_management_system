const express = require('express');
const app = express();
require('dotenv').config(); // مهم جداً لقراءة ملف الـ .env
const db = require('../models'); // 3. استدعاء الموديلز والـ Sequelize

// استدعاء ملف الـ Routes
const studentRoutes = require('./Student/routes/route'); 

// Middlewares
app.use(express.json());

// تفعيل الـ Routes
app.use('/api/complaints', studentRoutes);

// تشغيل السيرفر والتأكد من الداتا بيز
const PORT = process.env.PORT || 3000;

// الميزة هنا إنه مش هيقوم السيرفر إلا لو الداتا بيز ربطت صح
db.sequelize.sync().then(() => {
    console.log("✅ Database Connected & Synced");
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error("❌ Unable to connect to the database:", err.message);
});