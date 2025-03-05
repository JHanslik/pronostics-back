const predictionService = require("../services/predictionService");

// @desc    Obtenir une prédiction IA pour un match
// @route   GET /api/predictions/:matchId
// @access  Public
const getPrediction = async (req, res) => {
  try {
    const matchId = req.params.matchId;

    if (!matchId) {
      return res.status(400).json({
        success: false,
        message: "ID de match requis",
      });
    }

    const prediction = await predictionService.predictMatchResult(matchId);

    res.json({
      success: true,
      ...prediction,
    });
  } catch (error) {
    console.error("Erreur lors de la prédiction:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la prédiction",
      error: error.message,
    });
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
    console.error("Erreur lors de la synchronisation:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la synchronisation des données historiques",
      error: error.message,
    });
  }
};

module.exports = { getPrediction, syncHistoricalData };
