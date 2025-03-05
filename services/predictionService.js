const Match = require("../models/Match");
const footballApi = require("./footballApi");
const matchHistoryService = require("./matchHistoryService");

// Service de prédiction basé sur les données réelles
const predictionService = {
  // Prédire le résultat d'un match
  predictMatchResult: async (matchId) => {
    try {
      console.log(`Génération de prédiction pour le match ${matchId}`);

      // Récupérer les informations du match
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error("Match non trouvé");
      }

      const homeTeam = match.homeTeam;
      const awayTeam = match.awayTeam;

      console.log(`Match entre ${homeTeam} et ${awayTeam}`);

      // Récupérer l'historique des matchs depuis notre base de données locale
      console.log(`Récupération de l'historique pour ${homeTeam}`);
      const homeTeamMatches = await matchHistoryService.getTeamHistory(
        homeTeam,
        30
      );

      console.log(`Récupération de l'historique pour ${awayTeam}`);
      const awayTeamMatches = await matchHistoryService.getTeamHistory(
        awayTeam,
        30
      );

      console.log(
        `Récupération des confrontations directes entre ${homeTeam} et ${awayTeam}`
      );
      const h2hMatches = await matchHistoryService.getHeadToHeadMatches(
        homeTeam,
        awayTeam,
        10
      );

      // Calculer les statistiques des équipes
      const homeStats = calculateTeamStats(homeTeamMatches, homeTeam);
      const awayStats = calculateTeamStats(awayTeamMatches, awayTeam);
      const h2hStats = calculateH2HStats(h2hMatches, homeTeam, awayTeam);

      // Calculer les probabilités de victoire
      const homeProbability = calculateWinProbability(
        homeStats,
        awayStats,
        h2hStats,
        true
      );
      const awayProbability = calculateWinProbability(
        awayStats,
        homeStats,
        h2hStats,
        false
      );
      const drawProbability = Math.max(
        0,
        100 - homeProbability - awayProbability
      );

      // Prédire le score
      const predictedScore = predictScore(homeStats, awayStats, h2hStats);

      // Déterminer le résultat le plus probable
      let mostLikelyResult;
      let highestProbability = Math.max(
        homeProbability,
        awayProbability,
        drawProbability
      );

      if (highestProbability === homeProbability) {
        mostLikelyResult = "home";
      } else if (highestProbability === awayProbability) {
        mostLikelyResult = "away";
      } else {
        mostLikelyResult = "draw";
      }

      // Calculer la confiance dans les données
      const dataConfidence = calculateDataConfidence(
        homeTeamMatches,
        awayTeamMatches,
        h2hMatches
      );

      // Formater les matchs récents pour l'affichage
      const recentHomeMatches = formatRecentMatches(
        homeTeamMatches.slice(0, 5),
        homeTeam
      );
      const recentAwayMatches = formatRecentMatches(
        awayTeamMatches.slice(0, 5),
        awayTeam
      );
      const recentH2HMatches = formatH2HMatches(
        h2hMatches.slice(0, 5),
        homeTeam,
        awayTeam
      );

      // Retourner la prédiction complète
      return {
        matchId,
        homeTeam,
        awayTeam,
        probabilities: {
          home: Math.round(homeProbability),
          draw: Math.round(drawProbability),
          away: Math.round(awayProbability),
        },
        predictedScore: {
          home: predictedScore.home,
          away: predictedScore.away,
        },
        mostLikelyResult,
        dataConfidence,
        stats: {
          home: {
            recentForm: homeStats.form,
            averageGoalsScored: homeStats.averageGoalsScored.toFixed(2),
            averageGoalsConceded: homeStats.averageGoalsConceded.toFixed(2),
            winRate: homeStats.winRate.toFixed(2),
            homeAdvantage: homeStats.homeAdvantage.toFixed(2),
          },
          away: {
            recentForm: awayStats.form,
            averageGoalsScored: awayStats.averageGoalsScored.toFixed(2),
            averageGoalsConceded: awayStats.averageGoalsConceded.toFixed(2),
            winRate: awayStats.winRate.toFixed(2),
            awayPerformance: awayStats.awayPerformance.toFixed(2),
          },
          h2h: {
            homeWins: h2hStats.homeWins,
            awayWins: h2hStats.awayWins,
            draws: h2hStats.draws,
            totalMatches: h2hStats.totalMatches,
            averageHomeGoals: h2hStats.averageHomeGoals.toFixed(2),
            averageAwayGoals: h2hStats.averageAwayGoals.toFixed(2),
          },
        },
        recentMatches: {
          home: recentHomeMatches,
          away: recentAwayMatches,
          h2h: recentH2HMatches,
        },
      };
    } catch (error) {
      console.error("Erreur lors de la génération de la prédiction:", error);
      throw error;
    }
  },

  // Exporter la fonction de synchronisation pour pouvoir l'appeler depuis un contrôleur
  syncHistoricalMatches: matchHistoryService.syncHistoricalMatches,
};

// Enrichir les données de match via l'API externe
async function enrichMatchData(homeTeam, awayTeam) {
  try {
    // Récupérer les résultats des matchs passés via l'API
    const pastMatches = await footballApi.getMatchResults();

    // Filtrer les matchs pertinents pour les équipes concernées
    const relevantMatches = pastMatches.filter(
      (match) =>
        match.homeTeam === homeTeam ||
        match.awayTeam === homeTeam ||
        match.homeTeam === awayTeam ||
        match.awayTeam === awayTeam
    );

    // Sauvegarder les matchs dans la base de données s'ils n'existent pas déjà
    for (const matchData of relevantMatches) {
      const existingMatch = await Match.findOne({
        externalId: matchData.externalId,
      });
      if (!existingMatch) {
        await Match.create(matchData);
      }
    }

    console.log(`Données enrichies: ${relevantMatches.length} matchs ajoutés`);
  } catch (error) {
    console.error("Erreur lors de l'enrichissement des données:", error);
  }
}

// Calculer les statistiques d'une équipe
function calculateTeamStats(matches, teamName) {
  // Initialiser les statistiques
  const stats = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsScored: 0,
    goalsConceded: 0,
    homeWins: 0,
    homePlayed: 0,
    awayWins: 0,
    awayPlayed: 0,
    form: [], // 5 derniers résultats: 1 = victoire, 0 = nul, -1 = défaite
  };

  // Analyser chaque match
  matches.forEach((match) => {
    const isHome = match.homeTeam === teamName;
    const teamScore = isHome ? match.result.homeScore : match.result.awayScore;
    const opponentScore = isHome
      ? match.result.awayScore
      : match.result.homeScore;

    // Mettre à jour les statistiques générales
    stats.played++;
    stats.goalsScored += teamScore;
    stats.goalsConceded += opponentScore;

    // Déterminer le résultat
    let result;
    if (teamScore > opponentScore) {
      stats.wins++;
      result = 1; // Victoire
    } else if (teamScore < opponentScore) {
      stats.losses++;
      result = -1; // Défaite
    } else {
      stats.draws++;
      result = 0; // Nul
    }

    // Ajouter à la forme (limiter à 5 matchs)
    if (stats.form.length < 5) {
      stats.form.unshift(result);
    }

    // Statistiques à domicile/extérieur
    if (isHome) {
      stats.homePlayed++;
      if (result === 1) stats.homeWins++;
    } else {
      stats.awayPlayed++;
      if (result === 1) stats.awayWins++;
    }
  });

  // Calculer les moyennes
  stats.winRate = stats.played > 0 ? stats.wins / stats.played : 0;
  stats.homeWinRate =
    stats.homePlayed > 0 ? stats.homeWins / stats.homePlayed : 0;
  stats.awayWinRate =
    stats.awayPlayed > 0 ? stats.awayWins / stats.awayPlayed : 0;
  stats.averageGoalsScored =
    stats.played > 0 ? stats.goalsScored / stats.played : 0;
  stats.averageGoalsConceded =
    stats.played > 0 ? stats.goalsConceded / stats.played : 0;

  // Calculer la forme (moyenne pondérée des 5 derniers résultats)
  stats.formRating = stats.form.reduce((sum, result, index) => {
    // Les matchs plus récents ont plus de poids
    const weight = 1 - index * 0.15;
    return sum + result * weight;
  }, 0);

  return stats;
}

// Calculer les statistiques des confrontations directes
function calculateH2HStats(matches, homeTeam, awayTeam) {
  const stats = {
    total: matches.length,
    homeTeamWins: 0,
    awayTeamWins: 0,
    draws: 0,
    homeTeamGoals: 0,
    awayTeamGoals: 0,
  };

  matches.forEach((match) => {
    const isHomeTeamHome = match.homeTeam === homeTeam;
    const homeScore = match.result.homeScore;
    const awayScore = match.result.awayScore;

    // Ajouter les buts
    if (isHomeTeamHome) {
      stats.homeTeamGoals += homeScore;
      stats.awayTeamGoals += awayScore;
    } else {
      stats.homeTeamGoals += awayScore;
      stats.awayTeamGoals += homeScore;
    }

    // Déterminer le vainqueur
    if (homeScore > awayScore) {
      if (isHomeTeamHome) {
        stats.homeTeamWins++;
      } else {
        stats.awayTeamWins++;
      }
    } else if (homeScore < awayScore) {
      if (isHomeTeamHome) {
        stats.awayTeamWins++;
      } else {
        stats.homeTeamWins++;
      }
    } else {
      stats.draws++;
    }
  });

  // Calculer les moyennes
  stats.homeTeamWinRate =
    stats.total > 0 ? stats.homeTeamWins / stats.total : 0;
  stats.awayTeamWinRate =
    stats.total > 0 ? stats.awayTeamWins / stats.total : 0;
  stats.drawRate = stats.total > 0 ? stats.draws / stats.total : 0;
  stats.homeTeamAvgGoals =
    stats.total > 0 ? stats.homeTeamGoals / stats.total : 0;
  stats.awayTeamAvgGoals =
    stats.total > 0 ? stats.awayTeamGoals / stats.total : 0;

  return stats;
}

// Calculer la probabilité de victoire
function calculateWinProbability(teamStats, opponentStats, h2hStats, isHome) {
  // Facteurs de pondération
  const FORM_WEIGHT = 0.25;
  const WIN_RATE_WEIGHT = 0.2;
  const HOME_ADVANTAGE = 0.1; // Avantage du terrain
  const GOALS_WEIGHT = 0.2;
  const HEAD_TO_HEAD_WEIGHT = 0.25;

  // Calculer le score basé sur la forme récente
  const formScore = (teamStats.formRating + 1) / 2; // Normaliser entre 0 et 1

  // Calculer le score basé sur le taux de victoire
  const winRateScore = isHome ? teamStats.homeWinRate : teamStats.awayWinRate;

  // Calculer le score basé sur les buts
  const goalDifferential =
    teamStats.averageGoalsScored - opponentStats.averageGoalsConceded;
  const goalScore = Math.max(0, Math.min(1, (goalDifferential + 2) / 4)); // Normaliser entre 0 et 1

  // Calculer le score basé sur les confrontations directes
  let h2hScore = 0.5; // Valeur par défaut si pas assez de données
  if (h2hStats.total > 0) {
    h2hScore = isHome ? h2hStats.homeTeamWinRate : h2hStats.awayTeamWinRate;
  }

  // Calculer la probabilité finale
  let probability =
    formScore * FORM_WEIGHT +
    winRateScore * WIN_RATE_WEIGHT +
    goalScore * GOALS_WEIGHT +
    h2hScore * HEAD_TO_HEAD_WEIGHT;

  // Ajouter l'avantage du terrain
  if (isHome) {
    probability += HOME_ADVANTAGE;
  }

  // Ajuster en fonction du nombre de matchs disponibles
  const dataQualityFactor = Math.min(1, teamStats.played / 10);
  probability = probability * dataQualityFactor + 0.5 * (1 - dataQualityFactor);

  // Normaliser entre 0 et 0.8 (pour laisser de la place aux nuls)
  probability = Math.max(0, Math.min(0.8, probability));

  // Convertir en pourcentage
  return probability * 100;
}

// Prédire le score
function predictScore(homeStats, awayStats, h2hStats) {
  // Prédiction basée sur les moyennes de buts et les confrontations directes
  let predictedHomeGoals, predictedAwayGoals;

  if (h2hStats.total >= 3) {
    // Si nous avons suffisamment de confrontations directes, les utiliser davantage
    predictedHomeGoals =
      homeStats.averageGoalsScored * 0.4 +
      awayStats.averageGoalsConceded * 0.3 +
      h2hStats.homeTeamAvgGoals * 0.3;

    predictedAwayGoals =
      awayStats.averageGoalsScored * 0.4 +
      homeStats.averageGoalsConceded * 0.3 +
      h2hStats.awayTeamAvgGoals * 0.3;
  } else {
    // Sinon, se baser davantage sur les statistiques générales
    predictedHomeGoals =
      homeStats.averageGoalsScored * 0.6 + awayStats.averageGoalsConceded * 0.4;

    predictedAwayGoals =
      awayStats.averageGoalsScored * 0.6 + homeStats.averageGoalsConceded * 0.4;
  }

  // Ajuster en fonction de la qualité des données
  const homeDataQuality = Math.min(1, homeStats.played / 10);
  const awayDataQuality = Math.min(1, awayStats.played / 10);

  // Si peu de données, ajuster vers des scores plus probables
  if (homeDataQuality < 0.5 || awayDataQuality < 0.5) {
    predictedHomeGoals = predictedHomeGoals * 0.7 + 1.2 * 0.3;
    predictedAwayGoals = predictedAwayGoals * 0.7 + 0.8 * 0.3;
  }

  // Arrondir à un nombre entier
  return {
    home: Math.max(0, Math.round(predictedHomeGoals)),
    away: Math.max(0, Math.round(predictedAwayGoals)),
  };
}

// Formater les matchs récents pour l'affichage
function formatRecentMatches(matches, teamName) {
  return matches.slice(0, 5).map((match) => {
    const isHome = match.homeTeam === teamName;
    const teamScore = isHome ? match.result.homeScore : match.result.awayScore;
    const opponentScore = isHome
      ? match.result.awayScore
      : match.result.homeScore;
    const opponent = isHome ? match.awayTeam : match.homeTeam;

    let result;
    if (teamScore > opponentScore) {
      result = "V";
    } else if (teamScore < opponentScore) {
      result = "D";
    } else {
      result = "N";
    }

    return {
      date: match.startTime,
      opponent,
      score: `${teamScore}-${opponentScore}`,
      result,
      isHome,
    };
  });
}

// Formater les confrontations directes pour l'affichage
function formatH2HMatches(matches, homeTeam, awayTeam) {
  return matches.map((match) => {
    const isHomeTeamHome = match.homeTeam === homeTeam;
    const homeTeamScore = isHomeTeamHome
      ? match.result.homeScore
      : match.result.awayScore;
    const awayTeamScore = isHomeTeamHome
      ? match.result.awayScore
      : match.result.homeScore;

    return {
      date: match.startTime,
      homeTeamScore,
      awayTeamScore,
      result:
        homeTeamScore > awayTeamScore
          ? "home"
          : awayTeamScore > homeTeamScore
          ? "away"
          : "draw",
    };
  });
}

// Calculer la confiance dans les données
function calculateDataConfidence(homeMatches, awayMatches, h2hMatches) {
  // Plus nous avons de données, plus la confiance est élevée
  const homeConfidence = Math.min(1, homeMatches.length / 10);
  const awayConfidence = Math.min(1, awayMatches.length / 10);
  const h2hConfidence = Math.min(1, h2hMatches.length / 5) * 1.5; // Les confrontations directes ont plus de poids

  // Vérifier la récence des données
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));

  // Calculer le pourcentage de matchs récents
  const recentHomeMatches = homeMatches.filter(
    (m) => new Date(m.startTime) >= sixMonthsAgo
  ).length;
  const recentAwayMatches = awayMatches.filter(
    (m) => new Date(m.startTime) >= sixMonthsAgo
  ).length;

  const recencyFactor = Math.min(
    1,
    (recentHomeMatches + recentAwayMatches) / 10
  );

  // Moyenne pondérée
  const confidence =
    (homeConfidence * 0.35 + awayConfidence * 0.35 + h2hConfidence * 0.3) *
    (0.7 + recencyFactor * 0.3); // La récence améliore la confiance

  // Convertir en pourcentage
  return Math.round(confidence * 100);
}

// Ajouter une fonction pour vérifier si nous avons besoin de plus de données
async function checkDataQuality(homeTeam, awayTeam) {
  const homeMatches = await matchHistoryService.getTeamHistory(homeTeam, 30);
  const awayMatches = await matchHistoryService.getTeamHistory(awayTeam, 30);
  const h2hMatches = await matchHistoryService.getHeadToHeadMatches(
    homeTeam,
    awayTeam,
    10
  );

  const confidence = calculateDataConfidence(
    homeMatches,
    awayMatches,
    h2hMatches
  );

  return {
    confidence,
    needsMoreData: confidence < 50,
    recommendations: {
      needsHomeTeamData: homeMatches.length < 5,
      needsAwayTeamData: awayMatches.length < 5,
      needsH2HData: h2hMatches.length < 2,
    },
  };
}

module.exports = {
  ...predictionService,
  checkDataQuality,
};
