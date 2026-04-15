const express = require("express");
const router = express.Router();
const apiController = require("../controllers/apiController");

router.get("/topics", apiController.getTopics);               // Fórum BR
router.get("/topics/latam", apiController.getLatamTopics);    // Fórum LATAM

router.get("/rescue-queue", apiController.getRescueQueue);
router.post("/rescue-claim", apiController.claimRescueTopic);
router.post("/rescue-unclaim", apiController.unclaimRescueTopic);

router.post("/claim", apiController.claimTopic);
router.post("/unclaim", apiController.unclaimTopic);

// Stats
router.get("/user-stats", apiController.getUserStats);
router.get("/team-stats", apiController.getTeamStats);
router.get("/dashboard-stats", apiController.getDashboardStats);
router.get("/latam-user-stats", apiController.getLatamUserStats);

// Avatar
router.get("/user-avatar", apiController.getUserAvatar);

module.exports = router;