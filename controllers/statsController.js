const Match = require("../models/Match");
const Pronostic = require("../models/Pronostic");
const User = require("../models/User");
const mongoose = require("mongoose");

// @desc    Obtenir des statistiques globales de l'application
// @route   GET /api/stats
// @access  Public
const getGlobalStats = async (req, res) => {
  try {
    // Statistiques des matchs
    const matchStats = await Match.aggregate([
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ],
          totalMatches: [
            {
              $count: "count",
            },
          ],
          finishedMatchResults: [
            {
              $match: { status: "finished" },
            },
            {
              $group: {
                _id: "$result.winner",
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // Statistiques des pronostics
    const pronosticStats = await Pronostic.aggregate([
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalPoints: { $sum: "$pointsBet" },
              },
            },
          ],
          predictionCounts: [
            {
              $group: {
                _id: "$prediction",
                count: { $sum: 1 },
              },
            },
          ],
          totalPronostics: [
            {
              $count: "count",
            },
          ],
          avgPointsBet: [
            {
              $group: {
                _id: null,
                avg: { $avg: "$pointsBet" },
              },
            },
          ],
        },
      },
    ]);

    // Statistiques des utilisateurs
    const userStats = await User.aggregate([
      {
        $facet: {
          totalUsers: [
            {
              $count: "count",
            },
          ],
          roleCounts: [
            {
              $group: {
                _id: "$role",
                count: { $sum: 1 },
              },
            },
          ],
          pointsStats: [
            {
              $group: {
                _id: null,
                avgPoints: { $avg: "$points" },
                maxPoints: { $max: "$points" },
                minPoints: { $min: "$points" },
                totalPoints: { $sum: "$points" },
              },
            },
          ],
        },
      },
    ]);

    res.json({
      matchStats: matchStats[0],
      pronosticStats: pronosticStats[0],
      userStats: userStats[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = { getGlobalStats };
