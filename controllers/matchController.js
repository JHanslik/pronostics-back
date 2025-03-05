const Match = require("../models/Match");
const footballApi = require("../services/footballApi");

// @desc    Récupérer tous les matchs à venir
// @route   GET /api/matches
// @access  Public
const getMatches = async (req, res) => {
  try {
    const matches = await Match.find({ status: "scheduled" }).sort({
      startTime: 1,
    });
    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Récupérer un match par ID
// @route   GET /api/matches/:id
// @access  Public
const getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (match) {
      res.json(match);
    } else {
      res.status(404).json({ message: "Match non trouvé" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Synchroniser les matchs depuis l'API externe
// @route   GET /api/matches/sync
// @access  Private/Admin
const syncMatches = async (req, res) => {
  try {
    // Récupérer les matchs à venir depuis l'API
    const upcomingMatches = await footballApi.getUpcomingMatches();

    // Pour chaque match, l'ajouter à la base de données s'il n'existe pas déjà
    let newMatchesCount = 0;

    for (const match of upcomingMatches) {
      const existingMatch = await Match.findOne({
        externalId: match.externalId,
      });

      if (!existingMatch) {
        await Match.create(match);
        newMatchesCount++;
      }
    }

    // Récupérer les résultats des matchs terminés
    const matchResults = await footballApi.getMatchResults();

    // Mettre à jour les résultats des matchs
    let updatedMatchesCount = 0;

    for (const result of matchResults) {
      const match = await Match.findOne({ externalId: result.externalId });

      if (match && match.status !== "finished") {
        match.status = "finished";
        match.result = result.result;
        await match.save();
        updatedMatchesCount++;
      }
    }

    res.json({
      message: "Synchronisation réussie",
      newMatches: newMatchesCount,
      updatedMatches: updatedMatchesCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la synchronisation" });
  }
};

// @desc    Récupérer tous les matchs terminés
// @route   GET /api/matches/finished
// @access  Public
const getFinishedMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      status: "finished",
    }).sort({ startTime: -1 });

    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Récupérer les matchs terminés à traiter
// @route   GET /api/matches/finished/to-process
// @access  Private/Admin
const getFinishedMatchesToProcess = async (req, res) => {
  try {
    const matches = await Match.find({
      status: "finished",
      processed: { $ne: true },
    }).sort({ startTime: -1 });

    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Récupérer les matchs déjà traités
// @route   GET /api/matches/processed
// @access  Private/Admin
const getProcessedMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      status: "finished",
      processed: true,
    }).sort({ processedAt: -1 });

    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Mettre à jour le résultat d'un match
// @route   PUT /api/matches/:id/result
// @access  Private/Admin
const updateMatchResult = async (req, res) => {
  try {
    const { homeScore, awayScore, winner } = req.body;

    // Vérifier si le match existe
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: "Match non trouvé" });
    }

    // Mettre à jour le match
    match.status = "finished";
    match.result = {
      homeScore,
      awayScore,
      winner,
    };

    await match.save();

    res.json(match);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// @desc    Marquer un match comme traité
// @route   PUT /api/matches/:id/mark-processed
// @access  Private/Admin
const markMatchAsProcessed = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({ message: "Match non trouvé" });
    }

    match.processed = true;
    match.processedAt = new Date();
    await match.save();

    res.json({ message: "Match marqué comme traité", match });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  getMatches,
  getMatchById,
  syncMatches,
  getFinishedMatches,
  getFinishedMatchesToProcess,
  updateMatchResult,
  getProcessedMatches,
  markMatchAsProcessed,
};
