const express = require("express");
const router = express.Router();
const {
  getMatches,
  getMatchById,
  syncMatches,
  getFinishedMatches,
  getFinishedMatchesToProcess,
  updateMatchResult,
  getProcessedMatches,
  markMatchAsProcessed,
} = require("../controllers/matchController");
const { protect, admin } = require("../middlewares/authMiddleware");

// Routes spécifiques d'abord
router.get("/sync", protect, admin, syncMatches);
router.get("/finished", getFinishedMatches);
router.get("/finished/to-process", protect, admin, getFinishedMatchesToProcess);
router.get("/processed", protect, admin, getProcessedMatches);

// Routes avec paramètres ensuite
router.get("/:id", getMatchById);
router.put("/:id/result", protect, admin, updateMatchResult);
router.put("/:id/mark-processed", protect, admin, markMatchAsProcessed);

// Route générale en dernier
router.get("/", getMatches);

module.exports = router;
