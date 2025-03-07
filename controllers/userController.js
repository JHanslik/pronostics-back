const User = require("../models/User");
const Pronostic = require("../models/Pronostic");
const mongoose = require("mongoose");

// @desc    Obtenir le classement des utilisateurs avec leurs statistiques
// @route   GET /api/users/leaderboard
// @access  Public
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.aggregate([
      // Étape 1: Joindre les pronostics de chaque utilisateur
      {
        $lookup: {
          from: "pronostics",
          localField: "_id",
          foreignField: "user",
          as: "userPronostics",
        },
      },
      // Étape 2: Ajouter des champs calculés
      {
        $addFields: {
          totalPredictions: { $size: "$userPronostics" },
          winCount: {
            $size: {
              $filter: {
                input: "$userPronostics",
                as: "pronostic",
                cond: { $eq: ["$$pronostic.status", "won"] },
              },
            },
          },
        },
      },
      // Étape 3: Calculer le taux de réussite
      {
        $addFields: {
          successRate: {
            $cond: [
              { $gt: ["$totalPredictions", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$winCount", "$totalPredictions"] },
                      100,
                    ],
                  },
                ],
              },
              0,
            ],
          },
        },
      },
      // Étape 4: Projeter uniquement les champs nécessaires
      {
        $project: {
          _id: 1,
          username: 1,
          points: 1,
          totalPredictions: 1,
          winCount: 1,
          successRate: 1,
        },
      },
      // Étape 5: Trier par points décroissants
      {
        $sort: { points: -1 },
      },
    ]);

    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = { getLeaderboard };
