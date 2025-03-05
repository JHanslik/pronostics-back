const AIModel = require("../models/AIModel");
const AIPrediction = require("../models/AIPrediction");
const HistoricalMatch = require("../models/HistoricalMatch");
const Match = require("../models/Match");
const matchHistoryService = require("./matchHistoryService");
const footballApi = require("./footballApi");

// Service d'IA pour les prédictions de matchs
const aiService = {
  // Récupérer et stocker l'historique des matchs pour l'entraînement
  fetchHistoricalDataForTraining: async () => {
    try {
      console.log(
        "Récupération des données historiques pour l'entraînement de l'IA"
      );

      // Récupérer tous les matchs à venir pour identifier les équipes
      const upcomingMatches = await Match.find({ status: "scheduled" });

      // Extraire les noms des équipes uniques
      const teams = new Set();
      upcomingMatches.forEach((match) => {
        teams.add(match.homeTeam);
        teams.add(match.awayTeam);
      });

      console.log(
        `${teams.size} équipes identifiées pour la récupération de l'historique`
      );

      // Pour chaque équipe, récupérer son historique
      for (const team of teams) {
        await matchHistoryService.fetchAndStoreTeamHistory(team);

        // Pause pour éviter de surcharger l'API
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      console.log("Récupération des données historiques terminée");
      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données historiques:",
        error
      );
      return false;
    }
  },

  // Extraire les caractéristiques pour l'entraînement du modèle
  extractFeatures: async (homeTeam, awayTeam, date = new Date()) => {
    try {
      // Récupérer les matchs historiques des 5 dernières saisons
      const cutoffDate = new Date(date);
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);

      // Récupérer l'historique des équipes
      const homeTeamMatches = await HistoricalMatch.find({
        $or: [{ homeTeam }, { awayTeam: homeTeam }],
        startTime: { $gte: cutoffDate, $lt: date },
        status: "finished",
      }).sort({ startTime: -1 });

      const awayTeamMatches = await HistoricalMatch.find({
        $or: [{ homeTeam: awayTeam }, { awayTeam }],
        startTime: { $gte: cutoffDate, $lt: date },
        status: "finished",
      }).sort({ startTime: -1 });

      // Récupérer les confrontations directes
      const h2hMatches = await HistoricalMatch.find({
        $or: [
          { homeTeam, awayTeam },
          { homeTeam: awayTeam, awayTeam: homeTeam },
        ],
        startTime: { $gte: cutoffDate, $lt: date },
        status: "finished",
      }).sort({ startTime: -1 });

      // Calculer les statistiques des équipes
      const homeStats = calculateTeamStats(homeTeamMatches, homeTeam);
      const awayStats = calculateTeamStats(awayTeamMatches, awayTeam);
      const h2hStats = calculateH2HStats(h2hMatches, homeTeam, awayTeam);

      // Construire le vecteur de caractéristiques
      return {
        // Statistiques de l'équipe à domicile
        homeWinRate: homeStats.winRate,
        homeGoalsScored: homeStats.avgGoalsScored,
        homeGoalsConceded: homeStats.avgGoalsConceded,
        homeFormPoints: homeStats.recentFormPoints,
        homeMatchesPlayed: homeStats.matchesPlayed,

        // Statistiques de l'équipe à l'extérieur
        awayWinRate: awayStats.winRate,
        awayGoalsScored: awayStats.avgGoalsScored,
        awayGoalsConceded: awayStats.avgGoalsConceded,
        awayFormPoints: awayStats.recentFormPoints,
        awayMatchesPlayed: awayStats.matchesPlayed,

        // Statistiques des confrontations directes
        h2hHomeWins: h2hStats.homeWins,
        h2hAwayWins: h2hStats.awayWins,
        h2hDraws: h2hStats.draws,
        h2hHomeGoals: h2hStats.homeGoals,
        h2hAwayGoals: h2hStats.awayGoals,
        h2hMatchesPlayed: h2hStats.matchesPlayed,
      };
    } catch (error) {
      console.error("Erreur lors de l'extraction des caractéristiques:", error);
      throw error;
    }
  },

  // Entraîner un modèle d'IA sur les données historiques
  trainModel: async (modelType = "combined") => {
    try {
      console.log(`Entraînement d'un nouveau modèle de type ${modelType}`);

      // Récupérer tous les matchs historiques terminés
      const historicalMatches = await HistoricalMatch.find({
        status: "finished",
        "result.winner": { $ne: null },
      })
        .sort({ startTime: -1 })
        .limit(1000);

      if (historicalMatches.length < 50) {
        throw new Error(
          "Pas assez de données pour entraîner un modèle (minimum 50 matchs)"
        );
      }

      console.log(
        `${historicalMatches.length} matchs historiques trouvés pour l'entraînement`
      );

      // Préparer les données d'entraînement
      const trainingData = [];
      const trainingLabels = [];

      for (const match of historicalMatches) {
        try {
          // Extraire les caractéristiques à la date du match
          const features = await aiService.extractFeatures(
            match.homeTeam,
            match.awayTeam,
            match.startTime
          );

          // Ajouter aux données d'entraînement
          trainingData.push(features);
          trainingLabels.push(match.result.winner);
        } catch (error) {
          console.warn(
            `Erreur lors de l'extraction des caractéristiques pour le match ${match._id}:`,
            error
          );
          // Continuer avec le match suivant
          continue;
        }
      }

      console.log(
        `Données d'entraînement préparées: ${trainingData.length} échantillons`
      );

      // Entraîner le modèle (logique simplifiée)
      // Dans une implémentation réelle, vous utiliseriez une bibliothèque comme TensorFlow.js
      const modelParameters = trainSimpleModel(trainingData, trainingLabels);

      // Calculer la précision du modèle
      const accuracy = evaluateModel(
        modelParameters,
        trainingData,
        trainingLabels
      );

      // Sauvegarder le modèle dans la base de données
      const newModel = await AIModel.create({
        name: `FootballPredictor_${modelType}_v1`,
        description: `Modèle de prédiction de résultats de football basé sur ${trainingData.length} matchs historiques`,
        modelType,
        parameters: modelParameters,
        features: Object.keys(trainingData[0]),
        accuracy,
        trainedOn: new Date(),
        version: 1,
        active: true,
      });

      console.log(
        `Nouveau modèle créé avec ID: ${newModel._id} et précision: ${accuracy}`
      );
      return newModel;
    } catch (error) {
      console.error("Erreur lors de l'entraînement du modèle:", error);
      throw error;
    }
  },

  // Générer une prédiction pour un match
  predictMatch: async (matchId) => {
    try {
      // Récupérer les informations du match
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error("Match non trouvé");
      }

      // Vérifier si une prédiction existe déjà
      const existingPrediction = await AIPrediction.findOne({
        match: matchId,
      }).populate("model");

      if (existingPrediction) {
        console.log(`Prédiction existante trouvée pour le match ${matchId}`);
        return existingPrediction;
      }

      // Récupérer le modèle actif le plus récent
      const activeModel = await AIModel.findOne({
        active: true,
      }).sort({ trainedOn: -1 });

      if (!activeModel) {
        throw new Error("Aucun modèle d'IA actif trouvé");
      }

      // Extraire les caractéristiques du match
      const features = await aiService.extractFeatures(
        match.homeTeam,
        match.awayTeam
      );

      // Générer la prédiction
      const prediction = predictWithModel(activeModel.parameters, features);

      // Déterminer le résultat prédit
      let predictedResult;
      let confidence;

      if (
        prediction.homeWin > prediction.awayWin &&
        prediction.homeWin > prediction.draw
      ) {
        predictedResult = "home";
        confidence = prediction.homeWin;
      } else if (
        prediction.awayWin > prediction.homeWin &&
        prediction.awayWin > prediction.draw
      ) {
        predictedResult = "away";
        confidence = prediction.awayWin;
      } else {
        predictedResult = "draw";
        confidence = prediction.draw;
      }

      // Sauvegarder la prédiction
      const newPrediction = await AIPrediction.create({
        match: matchId,
        model: activeModel._id,
        homeTeamWinProbability: prediction.homeWin,
        awayTeamWinProbability: prediction.awayWin,
        drawProbability: prediction.draw,
        predictedResult,
        confidence,
        features,
      });

      // Mettre à jour la date de dernière utilisation du modèle
      await AIModel.findByIdAndUpdate(activeModel._id, {
        lastUsed: new Date(),
      });

      console.log(`Nouvelle prédiction générée pour le match ${matchId}`);
      return newPrediction;
    } catch (error) {
      console.error("Erreur lors de la génération de la prédiction:", error);
      throw error;
    }
  },

  // Mettre à jour les prédictions après un match
  updatePredictionResults: async (matchId) => {
    try {
      // Récupérer le match
      const match = await Match.findById(matchId);
      if (!match || match.status !== "finished" || !match.result.winner) {
        return false;
      }

      // Récupérer les prédictions pour ce match
      const predictions = await AIPrediction.find({ match: matchId });

      for (const prediction of predictions) {
        // Mettre à jour avec le résultat réel
        prediction.actualResult = match.result.winner;
        prediction.isCorrect =
          prediction.predictedResult === match.result.winner;
        await prediction.save();
      }

      console.log(
        `${predictions.length} prédictions mises à jour pour le match ${matchId}`
      );
      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour des résultats de prédiction:",
        error
      );
      return false;
    }
  },
};

// Fonctions utilitaires pour le modèle d'IA
function calculateTeamStats(matches, teamName) {
  if (!matches || matches.length === 0) {
    return {
      winRate: 0,
      avgGoalsScored: 0,
      avgGoalsConceded: 0,
      recentFormPoints: 0,
      matchesPlayed: 0,
    };
  }

  let wins = 0;
  let draws = 0;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let recentFormPoints = 0;

  // Calculer les statistiques sur tous les matchs
  matches.forEach((match, index) => {
    const isHome = match.homeTeam === teamName;
    const teamScore = isHome ? match.result.homeScore : match.result.awayScore;
    const opponentScore = isHome
      ? match.result.awayScore
      : match.result.homeScore;

    // Comptabiliser les buts
    totalGoalsScored += teamScore;
    totalGoalsConceded += opponentScore;

    // Déterminer le résultat
    if (
      (isHome && match.result.winner === "home") ||
      (!isHome && match.result.winner === "away")
    ) {
      wins++;
      // Calculer les points de forme récente (plus de poids aux matchs récents)
      if (index < 5) recentFormPoints += 3;
    } else if (match.result.winner === "draw") {
      draws++;
      // Calculer les points de forme récente
      if (index < 5) recentFormPoints += 1;
    }
  });

  return {
    winRate: matches.length > 0 ? wins / matches.length : 0,
    avgGoalsScored: matches.length > 0 ? totalGoalsScored / matches.length : 0,
    avgGoalsConceded:
      matches.length > 0 ? totalGoalsConceded / matches.length : 0,
    recentFormPoints: Math.min(recentFormPoints, 15), // Maximum 15 points (5 victoires)
    matchesPlayed: matches.length,
  };
}

function calculateH2HStats(matches, homeTeam, awayTeam) {
  if (!matches || matches.length === 0) {
    return {
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      homeGoals: 0,
      awayGoals: 0,
      matchesPlayed: 0,
    };
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homeGoals = 0;
  let awayGoals = 0;

  matches.forEach((match) => {
    // Normaliser les statistiques pour que homeTeam soit toujours l'équipe à domicile dans notre analyse
    if (match.homeTeam === homeTeam && match.awayTeam === awayTeam) {
      homeGoals += match.result.homeScore;
      awayGoals += match.result.awayScore;

      if (match.result.winner === "home") homeWins++;
      else if (match.result.winner === "away") awayWins++;
      else draws++;
    } else if (match.homeTeam === awayTeam && match.awayTeam === homeTeam) {
      // Inverser les statistiques car les équipes sont inversées
      homeGoals += match.result.awayScore;
      awayGoals += match.result.homeScore;

      if (match.result.winner === "away") homeWins++;
      else if (match.result.winner === "home") awayWins++;
      else draws++;
    }
  });

  return {
    homeWins,
    awayWins,
    draws,
    homeGoals,
    awayGoals,
    matchesPlayed: matches.length,
  };
}

// Fonction simplifiée d'entraînement de modèle
// Dans une implémentation réelle, vous utiliseriez une bibliothèque comme TensorFlow.js
function trainSimpleModel(features, labels) {
  // Simulation d'un modèle simple basé sur des poids
  const weights = {};
  const featureNames = Object.keys(features[0]);

  // Initialiser les poids
  featureNames.forEach((feature) => {
    weights[feature] = Math.random() * 2 - 1; // Valeur entre -1 et 1
  });

  // Simuler un entraînement simple
  // Dans une implémentation réelle, vous utiliseriez un algorithme d'optimisation

  return {
    weights,
    bias: {
      home: Math.random() * 0.5,
      away: Math.random() * 0.5,
      draw: Math.random() * 0.5,
    },
  };
}

// Fonction simplifiée d'évaluation de modèle
function evaluateModel(modelParams, features, labels) {
  let correct = 0;

  for (let i = 0; i < features.length; i++) {
    const prediction = predictWithModel(modelParams, features[i]);
    let predictedLabel;

    if (
      prediction.homeWin > prediction.awayWin &&
      prediction.homeWin > prediction.draw
    ) {
      predictedLabel = "home";
    } else if (
      prediction.awayWin > prediction.homeWin &&
      prediction.awayWin > prediction.draw
    ) {
      predictedLabel = "away";
    } else {
      predictedLabel = "draw";
    }

    if (predictedLabel === labels[i]) {
      correct++;
    }
  }

  return features.length > 0 ? correct / features.length : 0;
}

// Fonction simplifiée de prédiction avec le modèle
function predictWithModel(modelParams, features) {
  const { weights, bias } = modelParams;

  // Calculer les scores pour chaque résultat possible
  let homeScore = bias.home;
  let awayScore = bias.away;
  let drawScore = bias.draw;

  // Appliquer les poids aux caractéristiques
  Object.keys(features).forEach((feature) => {
    if (weights[feature]) {
      const value = features[feature];

      // Ajuster les scores en fonction des caractéristiques
      // Les caractéristiques favorables à l'équipe à domicile augmentent homeScore
      if (feature.startsWith("home")) {
        homeScore += weights[feature] * value;
      }
      // Les caractéristiques favorables à l'équipe à l'extérieur augmentent awayScore
      else if (feature.startsWith("away")) {
        awayScore += weights[feature] * value;
      }
      // Les caractéristiques de confrontations directes affectent les deux scores
      else if (feature.startsWith("h2h")) {
        if (feature.includes("HomeWins") || feature.includes("HomeGoals")) {
          homeScore += weights[feature] * value;
        } else if (
          feature.includes("AwayWins") ||
          feature.includes("AwayGoals")
        ) {
          awayScore += weights[feature] * value;
        } else if (feature.includes("Draws")) {
          drawScore += weights[feature] * value;
        }
      }
    }
  });

  // Convertir les scores en probabilités avec softmax
  const maxScore = Math.max(homeScore, awayScore, drawScore);
  const expHome = Math.exp(homeScore - maxScore);
  const expAway = Math.exp(awayScore - maxScore);
  const expDraw = Math.exp(drawScore - maxScore);
  const sumExp = expHome + expAway + expDraw;

  return {
    homeWin: expHome / sumExp,
    awayWin: expAway / sumExp,
    draw: expDraw / sumExp,
  };
}

module.exports = aiService;
