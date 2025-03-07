const Pronostic = require("../models/Pronostic");
const Match = require("../models/Match");
const User = require("../models/User");
const mongoose = require("mongoose");

// @desc    Créer un nouveau pronostic
// @route   POST /api/pronostics
// @access  Private
const createPronostic = async (req, res) => {
  try {
    const { matchId, prediction, pointsBet } = req.body;
    const userId = req.user._id;

    // Vérifier si le match existe
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match non trouvé" });
    }

    // Vérifier si le match n'a pas déjà commencé
    if (new Date(match.startTime) <= new Date()) {
      return res.status(400).json({ message: "Le match a déjà commencé" });
    }

    // Vérifier si l'utilisateur a déjà fait un pronostic pour ce match
    const existingPronostic = await Pronostic.findOne({
      user: userId,
      match: matchId,
    });
    if (existingPronostic) {
      return res
        .status(400)
        .json({ message: "Vous avez déjà fait un pronostic pour ce match" });
    }

    // Vérifier si l'utilisateur a assez de points
    const user = await User.findById(userId);
    if (user.points < pointsBet) {
      return res
        .status(400)
        .json({ message: "Vous n'avez pas assez de points" });
    }

    // Créer le pronostic
    const pronostic = await Pronostic.create({
      user: userId,
      match: matchId,
      prediction,
      pointsBet,
    });

    // Déduire les points de l'utilisateur
    user.points -= pointsBet;
    await user.save();

    res.status(201).json(pronostic);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Obtenir tous les pronostics de l'utilisateur
// @route   GET /api/pronostics
// @access  Private
const getUserPronostics = async (req, res) => {
  try {
    const pronostics = await Pronostic.find({ user: req.user._id })
      .populate("match", "homeTeam awayTeam startTime status result")
      .sort({ createdAt: -1 });

    res.json(pronostics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Traiter les pronostics après un match
// @route   POST /api/pronostics/process
// @access  Private/Admin
const processPronostics = async (req, res) => {
  try {
    const { matchId } = req.body;

    // Vérifier si le match existe et est terminé
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match non trouvé" });
    }

    if (match.status !== "finished") {
      return res
        .status(400)
        .json({ message: "Le match n'est pas encore terminé" });
    }

    // Récupérer tous les pronostics pour ce match
    const pronostics = await Pronostic.find({
      match: matchId,
      status: "pending",
    });

    let processed = 0;

    // Traiter chaque pronostic
    for (const pronostic of pronostics) {
      // Vérifier si le pronostic est correct
      const isCorrect = pronostic.prediction === match.result.winner;

      // Mettre à jour le statut du pronostic
      pronostic.status = isCorrect ? "won" : "lost";

      // Calculer les points gagnés (2x la mise si correct)
      if (isCorrect) {
        pronostic.pointsWon = pronostic.pointsBet * 2;

        // Ajouter les points à l'utilisateur
        const user = await User.findById(pronostic.user);
        user.points += pronostic.pointsWon;
        await user.save();
      }

      await pronostic.save();
      processed++;
    }

    // Marquer le match comme traité
    match.processed = true;
    match.processedAt = new Date();
    await match.save();

    res.json({ message: `${processed} pronostics traités` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Obtenir les statistiques des pronostics pour un match
// @route   GET /api/pronostics/stats/:matchId
// @access  Public
const getMatchPronosticsStats = async (req, res) => {
  try {
    const { matchId } = req.params;

    // Vérifier si l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ message: "ID de match invalide" });
    }

    const matchObjectId = new mongoose.Types.ObjectId(matchId);

    const stats = await Pronostic.aggregate([
      // Étape 1: Filtrer les pronostics pour ce match
      {
        $match: { match: matchObjectId },
      },
      // Étape 2: Grouper par prédiction
      {
        $group: {
          _id: "$prediction",
          count: { $sum: 1 },
          totalPointsBet: { $sum: "$pointsBet" },
          avgPointsBet: { $avg: "$pointsBet" },
        },
      },
      // Étape 3: Ajouter le total des pronostics pour calculer le pourcentage
      {
        $facet: {
          predictionStats: [{ $match: {} }],
          totalCount: [{ $count: "total" }],
        },
      },
      // Étape 4: Dérouler les résultats et calculer les pourcentages
      {
        $unwind: "$totalCount",
      },
      {
        $unwind: "$predictionStats",
      },
      {
        $project: {
          prediction: "$predictionStats._id",
          count: "$predictionStats.count",
          percentage: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$predictionStats.count", "$totalCount.total"] },
                  100,
                ],
              },
              1,
            ],
          },
          totalPointsBet: "$predictionStats.totalPointsBet",
          avgPointsBet: { $round: ["$predictionStats.avgPointsBet", 0] },
        },
      },
      // Étape 5: Trier par nombre de pronostics
      {
        $sort: { count: -1 },
      },
    ]);

    // Récupérer les informations du match
    const match = await Match.findById(matchId).select(
      "homeTeam awayTeam startTime status"
    );

    res.json({
      match,
      stats,
      totalPronostics:
        stats.length > 0 ? stats.reduce((sum, item) => sum + item.count, 0) : 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  createPronostic,
  getUserPronostics,
  processPronostics,
  getMatchPronosticsStats,
};
