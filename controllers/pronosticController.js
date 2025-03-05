const Pronostic = require("../models/Pronostic");
const Match = require("../models/Match");
const User = require("../models/User");

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

module.exports = { createPronostic, getUserPronostics, processPronostics };
