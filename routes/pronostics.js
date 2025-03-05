const express = require("express");
const router = express.Router();
const {
  createPronostic,
  getUserPronostics,
  processPronostics,
} = require("../controllers/pronosticController");
const { protect, admin } = require("../middlewares/authMiddleware");

router.post("/", protect, createPronostic);
router.get("/", protect, getUserPronostics);
router.post("/process", protect, admin, processPronostics);

module.exports = router;
