const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/apiRoutes");
const topicCacheService = require("./services/topicCacheService");
const { sequelize, testConnection } = require('./dbConection');

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

topicCacheService.startTopicWorkers();

require("./services/aiService");

(async () => {
  await testConnection();
  try {
    await sequelize.sync();
    console.log('Modelos sincronizados com o banco de dados.');
  } catch (error) {
    console.error('Erro ao sincronizar modelos:', error);
  }
})();

module.exports = app;
