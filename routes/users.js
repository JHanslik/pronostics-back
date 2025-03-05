const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middlewares/authMiddleware");
const User = require("../models/User");

// @desc    Obtenir le classement des utilisateurs
// @route   GET /api/users/leaderboard
// @access  Public
router.get("/leaderboard", async (req, res) => {
  try {
    const users = await User.find()
      .select("username points")
      .sort({ points: -1 })
      .limit(20);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
