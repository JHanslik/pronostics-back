const aiService = require("../services/aiService");
const Match = require("../models/Match");
const AIPrediction = require("../models/AIPrediction");
const AIModel = require("../models/AIModel");

const aiController = {
  // Récupérer l'historique des matchs pour l'entraînement
  fetchHistoricalData: async (req, res) => {
    try {
      const result = await aiService.fetchHistoricalDataForTraining();

      if (result) {
        res.status(200).json({
          success: true,
          message: "Récupération des données historiques terminée avec succès",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Erreur lors de la récupération des données historiques",
        });
      }
    } catch (error) {
      console.error("Erreur dans le contrôleur fetchHistoricalData:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des données historiques",
        error: error.message,
      });
    }
  },

  // Entraîner un nouveau modèle d'IA
  trainModel: async (req, res) => {
    try {
      const { modelType } = req.body;

      if (
        !modelType ||
        !["h2h", "team_performance", "combined"].includes(modelType)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Type de modèle invalide. Valeurs acceptées: h2h, team_performance, combined",
        });
      }

      const newModel = await aiService.trainModel(modelType);

      res.status(201).json({
        success: true,
        message: "Modèle entraîné avec succès",
        model: {
          id: newModel._id,
          name: newModel.name,
          accuracy: newModel.accuracy,
          trainedOn: newModel.trainedOn,
        },
      });
    } catch (error) {
      console.error("Erreur dans le contrôleur trainModel:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'entraînement du modèle",
        error: error.message,
      });
    }
  },

  // Générer une prédiction pour un match
  predictMatch: async (req, res) => {
    try {
      const { matchId } = req.params;

      if (!matchId) {
        return res.status(400).json({
          success: false,
          message: "ID de match requis",
        });
      }

      // Vérifier si le match existe
      const match = await Match.findById(matchId);
      if (!match) {
        return res.status(404).json({
          success: false,
          message: "Match non trouvé",
        });
      }

      // Générer la prédiction
      const prediction = await aiService.predictMatch(matchId);

      res.status(200).json({
        success: true,
        prediction: {
          match: {
            id: match._id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            startTime: match.startTime,
          },
          homeTeamWinProbability: prediction.homeTeamWinProbability,
          awayTeamWinProbability: prediction.awayTeamWinProbability,
          drawProbability: prediction.drawProbability,
          predictedResult: prediction.predictedResult,
          confidence: prediction.confidence,
        },
      });
    } catch (error) {
      console.error("Erreur dans le contrôleur predictMatch:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la génération de la prédiction",
        error: error.message,
      });
    }
  },

  // Récupérer toutes les prédictions pour un match
  getMatchPredictions: async (req, res) => {
    try {
      const { matchId } = req.params;

      if (!matchId) {
        return res.status(400).json({
          success: false,
          message: "ID de match requis",
        });
      }

      // Récupérer les prédictions
      const predictions = await AIPrediction.find({ match: matchId })
        .populate("model", "name accuracy")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        predictions: predictions.map((p) => ({
          id: p._id,
          model: p.model,
          homeTeamWinProbability: p.homeTeamWinProbability,
          awayTeamWinProbability: p.awayTeamWinProbability,
          drawProbability: p.drawProbability,
          predictedResult: p.predictedResult,
          confidence: p.confidence,
          createdAt: p.createdAt,
          actualResult: p.actualResult,
          isCorrect: p.isCorrect,
        })),
      });
    } catch (error) {
      console.error("Erreur dans le contrôleur getMatchPredictions:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des prédictions",
        error: error.message,
      });
    }
  },

  // Récupérer tous les modèles d'IA
  getModels: async (req, res) => {
    try {
      const models = await AIModel.find().sort({ trainedOn: -1 });

      res.status(200).json({
        success: true,
        models: models.map((m) => ({
          id: m._id,
          name: m.name,
          description: m.description,
          modelType: m.modelType,
          accuracy: m.accuracy,
          trainedOn: m.trainedOn,
          lastUsed: m.lastUsed,
          version: m.version,
          active: m.active,
        })),
      });
    } catch (error) {
      console.error("Erreur dans le contrôleur getModels:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des modèles",
        error: error.message,
      });
    }
  },

  // Activer/désactiver un modèle
  toggleModelStatus: async (req, res) => {
    try {
      const { modelId } = req.params;
      const { active } = req.body;

      if (active === undefined) {
        return res.status(400).json({
          success: false,
          message: "Le statut 'active' est requis",
        });
      }

      const model = await AIModel.findById(modelId);
      if (!model) {
        return res.status(404).json({
          success: false,
          message: "Modèle non trouvé",
        });
      }

      model.active = active;
      await model.save();

      res.status(200).json({
        success: true,
        message: `Modèle ${active ? "activé" : "désactivé"} avec succès`,
        model: {
          id: model._id,
          name: model.name,
          active: model.active,
        },
      });
    } catch (error) {
      console.error("Erreur dans le contrôleur toggleModelStatus:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la modification du statut du modèle",
        error: error.message,
      });
    }
  },
};

module.exports = aiController;
