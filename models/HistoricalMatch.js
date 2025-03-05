const mongoose = require("mongoose");

const historicalMatchSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      required: true,
      unique: true,
    },
    homeTeam: {
      type: String,
      required: true,
      index: true,
    },
    awayTeam: {
      type: String,
      required: true,
      index: true,
    },
    league: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "finished", "cancelled"],
      default: "finished",
    },
    result: {
      homeScore: {
        type: Number,
        default: null,
      },
      awayScore: {
        type: Number,
        default: null,
      },
      winner: {
        type: String,
        enum: ["home", "away", "draw", null],
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Créer des index composites pour accélérer les requêtes
historicalMatchSchema.index({ homeTeam: 1, awayTeam: 1 });
historicalMatchSchema.index({ startTime: -1 });

const HistoricalMatch = mongoose.model(
  "HistoricalMatch",
  historicalMatchSchema
);

module.exports = HistoricalMatch;
