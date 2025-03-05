const express = require("express");
const router = express.Router();
const {
  getMatches,
  getMatchById,
  syncMatches,
} = require("../controllers/matchController");
const { protect, admin } = require("../middlewares/authMiddleware");

router.get("/", getMatches);
router.get("/sync", protect, admin, syncMatches);
router.get("/:id", getMatchById);

module.exports = router;
