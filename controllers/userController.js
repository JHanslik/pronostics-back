const User = require("../models/User");
const Pronostic = require("../models/Pronostic");

// @desc    Obtenir le classement des utilisateurs avec leurs statistiques
// @route   GET /api/users/leaderboard
// @access  Public
const getLeaderboard = async (req, res) => {
  try {
    // Récupérer tous les utilisateurs triés par points
    const users = await User.find()
      .select("username points")
      .sort({ points: -1 });

    // Pour chaque utilisateur, récupérer ses statistiques de pronostics
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Récupérer tous les pronostics de l'utilisateur
        const pronostics = await Pronostic.find({ user: user._id });

        // Calculer les statistiques
        const totalPredictions = pronostics.length;
        const winCount = pronostics.filter((p) => p.status === "won").length;

        // Retourner l'utilisateur avec ses statistiques
        return {
          _id: user._id,
          username: user.username,
          points: user.points,
          totalPredictions,
          winCount,
          successRate:
            totalPredictions > 0
              ? Math.round((winCount / totalPredictions) * 100)
              : 0,
        };
      })
    );

    res.json(usersWithStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = { getLeaderboard };
