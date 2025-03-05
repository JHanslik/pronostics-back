const mongoose = require("mongoose");

const pronosticSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
    },
    prediction: {
      type: String,
      enum: ["home", "away", "draw"],
      required: true,
    },
    pointsBet: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "won", "lost"],
      default: "pending",
    },
    pointsWon: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Empêcher un utilisateur de faire plusieurs pronostics sur le même match
pronosticSchema.index({ user: 1, match: 1 }, { unique: true });

const Pronostic = mongoose.model("Pronostic", pronosticSchema);

module.exports = Pronostic;
