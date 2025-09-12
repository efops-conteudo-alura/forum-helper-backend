// src/app.js

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Diz ao Express que todas as rotas que começam com /api devem ser gerenciadas pelo nosso arquivo de rotas
app.use('/api', apiRoutes);

module.exports = app;