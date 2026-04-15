const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/apiRoutes");
const topicCacheService = require("./services/topicCacheService");

const app = express();

app.use(cors());
app.use(express.json());


app.use("/api", apiRoutes);

topicCacheService.startTopicWorkers();

require("./services/aiService"); 

module.exports = app;