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

module.exports = { getPrediction };
