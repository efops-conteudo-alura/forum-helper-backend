// src/routes/apiRoutes.js

const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Mapeia cada rota para uma função específica no controller
router.get('/topics', apiController.getTopics);
router.post('/claim', apiController.claimTopic);
router.post('/unclaim', apiController.unclaimTopic); // Rota para liberar o tópico
router.get('/user-stats', apiController.getUserStats);

module.exports = router;