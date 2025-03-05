const express = require("express");
const router = express.Router();
const {
  getPrediction,
  syncHistoricalData,
} = require("../controllers/predictionController");
const { protect, admin } = require("../middlewares/authMiddleware");

router.get("/sync-history", protect, admin, syncHistoricalData);
router.get("/:matchId", getPrediction);

module.exports = router;
