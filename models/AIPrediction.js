const mongoose = require("mongoose");

const aiPredictionSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
    },
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIModel",
      required: true,
    },
    homeTeamWinProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    awayTeamWinProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    drawProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    predictedResult: {
      type: String,
      enum: ["home", "away", "draw"],
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    actualResult: {
      type: String,
      enum: ["home", "away", "draw", null],
      default: null,
    },
    isCorrect: {
      type: Boolean,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Empêcher plusieurs prédictions du même modèle pour le même match
aiPredictionSchema.index({ match: 1, model: 1 }, { unique: true });

const AIPrediction = mongoose.model("AIPrediction", aiPredictionSchema);

module.exports = AIPrediction;
