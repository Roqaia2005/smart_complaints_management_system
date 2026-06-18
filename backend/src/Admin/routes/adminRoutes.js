const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// --- (Categories) --- 
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.addCategory);
router.patch('/categories/:id', adminController.patchCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// --- (Users) --- 
router.get('/users', adminController.getUsers);
router.post('/users', adminController.addUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id', adminController.patchUser);

// ---(Regulations) --- 
router.get('/regulations', adminController.getRegulations);
router.post('/regulations', adminController.addRegulation);
router.delete('/regulations/:id', adminController.removeRegulation);

// ---(Priority Rules) --- 
router.get('/priority-rules', adminController.getRules);
router.post('/priority-rules', adminController.savePriorityRule);

// --- (Audit Logs) --- 
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;