const express = require("express");
const router = express.Router();
const {
  createPronostic,
  getUserPronostics,
  processPronostics,
  getMatchPronosticsStats,
} = require("../controllers/pronosticController");
const { protect, admin } = require("../middlewares/authMiddleware");

router.post("/", protect, createPronostic);
router.get("/", protect, getUserPronostics);
router.post("/process", protect, admin, processPronostics);
router.get("/stats/:matchId", getMatchPronosticsStats);

module.exports = router;
