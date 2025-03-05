const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middlewares/authMiddleware");
const { getLeaderboard } = require("../controllers/userController");

// @desc    Obtenir le classement des utilisateurs
// @route   GET /api/users/leaderboard
// @access  Public
router.get("/leaderboard", getLeaderboard);

module.exports = router;
