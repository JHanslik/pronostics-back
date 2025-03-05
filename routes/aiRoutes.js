const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const authMiddleware = require("../middlewares/authMiddleware");

// Routes publiques
router.get("/predictions/:matchId", aiController.getMatchPredictions);

// Routes protégées (admin uniquement)
router.post(
  "/historical-data",
  authMiddleware.protect,
  authMiddleware.admin,
  aiController.fetchHistoricalData
);
router.post(
  "/train",
  authMiddleware.protect,
  authMiddleware.admin,
  aiController.trainModel
);
router.post(
  "/predict/:matchId",
  authMiddleware.protect,
  aiController.predictMatch
);
router.get(
  "/models",
  authMiddleware.protect,
  authMiddleware.admin,
  aiController.getModels
);
router.patch(
  "/models/:modelId",
  authMiddleware.protect,
  authMiddleware.admin,
  aiController.toggleModelStatus
);

module.exports = router;
