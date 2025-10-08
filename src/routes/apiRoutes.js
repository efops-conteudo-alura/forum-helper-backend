// src/routes/apiRoutes.js

const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Mapeia cada rota para uma função específica no controller
router.get('/topics', apiController.getTopics);
router.post('/claim', apiController.claimTopic);
router.post('/unclaim', apiController.unclaimTopic);
router.get('/user-stats', apiController.getUserStats);
router.get('/team-stats', apiController.getTeamStats);


router.get('/dashboard-stats', apiController.getDashboardStats);


module.exports = router;
