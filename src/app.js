// src/app.js

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');
const topicCacheService = require('./services/topicCacheService'); // <<< IMPORTA O NOVO SERVIÇO

const app = express();

app.use(cors());
app.use(express.json());

// Diz ao Express que todas as rotas que começam com /api devem ser gerenciadas pelo nosso arquivo de rotas
app.use('/api', apiRoutes);

// Inicia os workers em background DEPOIS que tudo está configurado
topicCacheService.startTopicWorkers(); // <<< INICIA OS WORKERS

module.exports = app;