const express = require('express');
const authenticate = require("../../Middlewares/auth");
const { isManager } = require("../../Middlewares/authorize");
const {
    getDashboardData,
    overviewController,
    departmentPerformanceController,
    heatmapController,
    getRecommendationsController,
    updateRecommendationStatusController,
    reportsController,
    topIssuesController
} = require('../controllers/manager.controllers');

const managerRoutes = express.Router();
managerRoutes.use(authenticate, isManager);

managerRoutes.get('/dashboard', getDashboardData);
managerRoutes.get('/department-performance', departmentPerformanceController);
managerRoutes.get('/heatmap', heatmapController);

// مسار نظيف وصافي بدون علامات استفهام تزعل المكتبة
managerRoutes.get('/top-issue', topIssuesController);

module.exports = managerRoutes;