const predictionService = require("../services/predictionService");

// @desc    Obtenir une prédiction IA pour un match
// @route   GET /api/predictions/:matchId
// @access  Public
const getPrediction = async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const prediction = await predictionService.predictMatchResult(matchId);
    res.json(prediction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la prédiction" });
  }
};

// @desc    Synchroniser les données historiques pour toutes les équipes
// @route   GET /api/predictions/sync-history
// @access  Admin
const syncHistoricalData = async (req, res) => {
  try {
    const result = await predictionService.syncHistoricalMatches();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erreur lors de la synchronisation des données historiques",
    });
  }
};

module.exports = { getPrediction, syncHistoricalData };
