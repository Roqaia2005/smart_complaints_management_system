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
//managerRoutes.use(authenticate, isManager);

managerRoutes.get('/dashboard', getDashboardData);
managerRoutes.get('/department-performance', departmentPerformanceController);
managerRoutes.get('/heatmap', heatmapController);
managerRoutes.get('/reports', reportsController);
managerRoutes.get('/top-issues/:category_id', topIssuesController);

module.exports = managerRoutes;