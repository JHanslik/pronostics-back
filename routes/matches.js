const express = require("express");
const router = express.Router();
const {
  getMatches,
  getMatchById,
  syncMatches,
  getFinishedMatches,
  updateMatchResult,
} = require("../controllers/matchController");
const { protect, admin } = require("../middlewares/authMiddleware");

router.get("/", getMatches);
router.get("/sync", protect, admin, syncMatches);
router.get("/finished", getFinishedMatches);
router.get("/:id", getMatchById);
router.put("/:id/result", protect, admin, updateMatchResult);

module.exports = router;
