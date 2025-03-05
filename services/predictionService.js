const Match = require("../models/Match");
const footballApi = require("./footballApi");

// Service de prédiction basé sur les données réelles
const predictionService = {
  // Prédire le résultat d'un match
  predictMatchResult: async (matchId) => {
    try {
      // Récupérer le match à prédire
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error("Match non trouvé");
      }

      // Récupérer l'historique des matchs pour les deux équipes
      const homeTeamMatches = await Match.find({
        $or: [{ homeTeam: match.homeTeam }, { awayTeam: match.homeTeam }],
        status: "finished",
        _id: { $ne: match._id },
        "result.homeScore": { $ne: null },
        "result.awayScore": { $ne: null },
      })
        .sort({ startTime: -1 })
        .limit(15);

      const awayTeamMatches = await Match.find({
        $or: [{ homeTeam: match.awayTeam }, { awayTeam: match.awayTeam }],
        status: "finished",
        _id: { $ne: match._id },
        "result.homeScore": { $ne: null },
        "result.awayScore": { $ne: null },
      })
        .sort({ startTime: -1 })
        .limit(15);

      // Récupérer les confrontations directes
      const headToHeadMatches = await Match.find({
        $or: [
          { homeTeam: match.homeTeam, awayTeam: match.awayTeam },
          { homeTeam: match.awayTeam, awayTeam: match.homeTeam },
        ],
        status: "finished",
        _id: { $ne: match._id },
        "result.homeScore": { $ne: null },
        "result.awayScore": { $ne: null },
      })
        .sort({ startTime: -1 })
        .limit(5);

      // Si nous n'avons pas assez de données, essayer de récupérer plus de données via l'API externe
      if (homeTeamMatches.length < 5 || awayTeamMatches.length < 5) {
        await enrichMatchData(match.homeTeam, match.awayTeam);

        // Récupérer à nouveau les données après enrichissement
        const updatedHomeTeamMatches = await Match.find({
          $or: [{ homeTeam: match.homeTeam }, { awayTeam: match.homeTeam }],
          status: "finished",
          _id: { $ne: match._id },
          "result.homeScore": { $ne: null },
          "result.awayScore": { $ne: null },
        })
          .sort({ startTime: -1 })
          .limit(15);

        const updatedAwayTeamMatches = await Match.find({
          $or: [{ homeTeam: match.awayTeam }, { awayTeam: match.awayTeam }],
          status: "finished",
          _id: { $ne: match._id },
          "result.homeScore": { $ne: null },
          "result.awayScore": { $ne: null },
        })
          .sort({ startTime: -1 })
          .limit(15);

        // Utiliser les données enrichies si disponibles
        if (updatedHomeTeamMatches.length > homeTeamMatches.length) {
          homeTeamMatches = updatedHomeTeamMatches;
        }

        if (updatedAwayTeamMatches.length > awayTeamMatches.length) {
          awayTeamMatches = updatedAwayTeamMatches;
        }
      }

      // Calculer les statistiques pour l'équipe à domicile
      const homeTeamStats = calculateTeamStats(homeTeamMatches, match.homeTeam);

      // Calculer les statistiques pour l'équipe à l'extérieur
      const awayTeamStats = calculateTeamStats(awayTeamMatches, match.awayTeam);

      // Calculer les statistiques des confrontations directes
      const h2hStats = calculateH2HStats(
        headToHeadMatches,
        match.homeTeam,
        match.awayTeam
      );

      // Calculer les probabilités
      const homeProbability = calculateWinProbability(
        homeTeamStats,
        awayTeamStats,
        h2hStats,
        true
      );
      const awayProbability = calculateWinProbability(
        awayTeamStats,
        homeTeamStats,
        h2hStats,
        false
      );
      const drawProbability = Math.max(
        0,
        1 - homeProbability - awayProbability
      );

      // Prédire le score
      const predictedScore = predictScore(
        homeTeamStats,
        awayTeamStats,
        h2hStats
      );

      // Déterminer le résultat le plus probable
      let mostLikelyResult;
      if (
        homeProbability > awayProbability &&
        homeProbability > drawProbability
      ) {
        mostLikelyResult = "home";
      } else if (
        awayProbability > homeProbability &&
        awayProbability > drawProbability
      ) {
        mostLikelyResult = "away";
      } else {
        mostLikelyResult = "draw";
      }

      return {
        match: {
          id: match._id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          startTime: match.startTime,
        },
        prediction: {
          homeWinProbability: Math.round(homeProbability * 100),
          drawProbability: Math.round(drawProbability * 100),
          awayWinProbability: Math.round(awayProbability * 100),
          predictedScore: predictedScore,
          mostLikelyResult: mostLikelyResult,
          confidence: Math.round(
            Math.max(homeProbability, drawProbability, awayProbability) * 100
          ),
        },
        stats: {
          homeTeam: {
            ...homeTeamStats,
            recentMatches: formatRecentMatches(homeTeamMatches, match.homeTeam),
          },
          awayTeam: {
            ...awayTeamStats,
            recentMatches: formatRecentMatches(awayTeamMatches, match.awayTeam),
          },
          headToHead: {
            ...h2hStats,
            recentMatches: formatH2HMatches(
              headToHeadMatches,
              match.homeTeam,
              match.awayTeam
            ),
          },
        },
        dataQuality: {
          homeTeamMatchesCount: homeTeamMatches.length,
          awayTeamMatchesCount: awayTeamMatches.length,
          h2hMatchesCount: headToHeadMatches.length,
          confidence: calculateDataConfidence(
            homeTeamMatches.length,
            awayTeamMatches.length,
            headToHeadMatches.length
          ),
        },
      };
    } catch (error) {
      console.error("Erreur lors de la prédiction:", error);
      throw error;
    }
  },
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

  // Normaliser entre 0 et 0.8 (pour laisser de la place aux nuls)
  return Math.max(0, Math.min(0.8, probability));
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
  const homeConfidence = Math.min(1, homeMatches / 10);
  const awayConfidence = Math.min(1, awayMatches / 10);
  const h2hConfidence = Math.min(1, h2hMatches / 5) * 1.5; // Les confrontations directes ont plus de poids

  // Moyenne pondérée
  const confidence =
    homeConfidence * 0.35 + awayConfidence * 0.35 + h2hConfidence * 0.3;

  // Convertir en pourcentage
  return Math.round(confidence * 100);
}

module.exports = predictionService;
