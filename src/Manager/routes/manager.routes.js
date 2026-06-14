const express = require('express');
const {
    overviewController,
    departmentPerformanceController,
    heatmapController,
    getRecommendationsController,
    updateRecommendationStatusController,
    reportsController,
    topIssuesController
} = require('../controllers/manager.controllers');

const managerRoutes = express.Router();

managerRoutes.get('/overview', overviewController);
managerRoutes.get('/department-performance', departmentPerformanceController);
managerRoutes.get('/heatmap', heatmapController);
managerRoutes.get('/recommendations', getRecommendationsController);
managerRoutes.patch('/recommendations/:id', updateRecommendationStatusController);
managerRoutes.get('/reports', reportsController);
managerRoutes.get('/top-issues/:category_id', topIssuesController);

module.exports = managerRoutes;