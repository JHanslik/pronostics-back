const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      required: true,
      unique: true,
    },
    homeTeam: {
      type: String,
      required: true,
    },
    awayTeam: {
      type: String,
      required: true,
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
      default: "scheduled",
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

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;
