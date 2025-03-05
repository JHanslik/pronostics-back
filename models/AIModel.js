const mongoose = require("mongoose");

const aiModelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    modelType: {
      type: String,
      enum: ["h2h", "team_performance", "combined"],
      required: true,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    features: {
      type: [String],
      required: true,
    },
    accuracy: {
      type: Number,
      default: 0,
    },
    trainedOn: {
      type: Date,
      default: Date.now,
    },
    lastUsed: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const AIModel = mongoose.model("AIModel", aiModelSchema);

module.exports = AIModel;
