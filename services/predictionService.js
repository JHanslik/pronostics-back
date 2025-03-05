const Match = require("../models/Match");
const footballApi = require("./footballApi");
const matchHistoryService = require("./matchHistoryService");

// Service de prédiction basé sur les données réelles
const predictionService = {
  // Prédire le résultat d'un match
  predictMatchResult: async (matchId) => {
    try {
      console.log(`Prédiction pour le match ${matchId}`);

      // Récupérer les détails du match
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error(`Match non trouvé avec l'ID: ${matchId}`);
      }

      console.log(`Match trouvé: ${match.homeTeam} vs ${match.awayTeam}`);

      try {
        // Récupérer et stocker d'abord les données historiques si nécessaire
        console.log(
          `Récupération et stockage des données historiques pour ${match.homeTeam}`
        );
        await matchHistoryService.fetchAndStoreTeamHistory(match.homeTeam);

        console.log(
          `Récupération et stockage des données historiques pour ${match.awayTeam}`
        );
        await matchHistoryService.fetchAndStoreTeamHistory(match.awayTeam);

        // Récupérer et stocker les confrontations directes
        console.log(
          `Récupération des confrontations directes entre ${match.homeTeam} et ${match.awayTeam}`
        );
        await matchHistoryService.fetchAndStoreHeadToHeadMatches(
          match.homeTeam,
          match.awayTeam
        );
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des données historiques:",
          error
        );
        // Continuer même en cas d'erreur pour utiliser les données disponibles
      }

      // Maintenant récupérer l'historique des matchs pour les deux équipes
      const homeTeamMatches = await matchHistoryService.getTeamHistory(
        match.homeTeam
      );
      const awayTeamMatches = await matchHistoryService.getTeamHistory(
        match.awayTeam
      );

      console.log(
        `Historique récupéré: ${homeTeamMatches.length} matchs pour ${match.homeTeam}, ${awayTeamMatches.length} matchs pour ${match.awayTeam}`
      );

      // Récupérer les confrontations directes
      const h2hMatches = await matchHistoryService.getHeadToHeadMatches(
        match.homeTeam,
        match.awayTeam
      );

      console.log(
        `Confrontations directes: ${h2hMatches.length} matchs entre ${match.homeTeam} et ${match.awayTeam}`
      );

      // Calculer les statistiques des équipes
      const homeStats = calculateTeamStats(homeTeamMatches, match.homeTeam);
      const awayStats = calculateTeamStats(awayTeamMatches, match.awayTeam);
      const h2hStats = calculateH2HStats(
        h2hMatches,
        match.homeTeam,
        match.awayTeam
      );

      // Si nous n'avons pas assez de données, utiliser des valeurs par défaut
      const hasEnoughData =
        homeStats.matchesPlayed > 0 || awayStats.matchesPlayed > 0;

      // Calculer les probabilités de victoire
      let homeWinProbability, awayWinProbability;

      if (hasEnoughData) {
        homeWinProbability = calculateWinProbability(
          homeStats,
          awayStats,
          h2hStats,
          true
        );
        awayWinProbability = calculateWinProbability(
          awayStats,
          homeStats,
          h2hStats,
          false
        );
      } else {
        console.log(
          "Données insuffisantes, utilisation de probabilités par défaut"
        );
        // Valeurs par défaut avec léger avantage à domicile
        homeWinProbability = 0.45;
        awayWinProbability = 0.35;
      }

      // Ajuster pour que la somme des probabilités soit égale à 1
      const totalProb = homeWinProbability + awayWinProbability;
      const normalizedHomeWinProb =
        totalProb > 0 ? (homeWinProbability / totalProb) * 0.9 : 0.45;
      const normalizedAwayWinProb =
        totalProb > 0 ? (awayWinProbability / totalProb) * 0.9 : 0.35;
      const drawProbability = 1 - normalizedHomeWinProb - normalizedAwayWinProb;

      console.log(
        `Probabilités calculées: Domicile=${normalizedHomeWinProb.toFixed(
          2
        )}, Nul=${drawProbability.toFixed(
          2
        )}, Extérieur=${normalizedAwayWinProb.toFixed(2)}`
      );

      // Déterminer le résultat le plus probable
      let mostLikelyResult;
      if (
        normalizedHomeWinProb > normalizedAwayWinProb &&
        normalizedHomeWinProb > drawProbability
      ) {
        mostLikelyResult = "home";
      } else if (
        normalizedAwayWinProb > normalizedHomeWinProb &&
        normalizedAwayWinProb > drawProbability
      ) {
        mostLikelyResult = "away";
      } else {
        mostLikelyResult = "draw";
      }

      // Prédire un score basé sur les statistiques
      let predictedHomeGoals, predictedAwayGoals;

      if (hasEnoughData) {
        predictedHomeGoals = Math.round(
          homeStats.avgGoalsScored * 0.7 + awayStats.avgGoalsConceded * 0.3
        );
        predictedAwayGoals = Math.round(
          awayStats.avgGoalsScored * 0.7 + homeStats.avgGoalsConceded * 0.3
        );
      } else {
        // Scores par défaut
        predictedHomeGoals = mostLikelyResult === "home" ? 1 : 0;
        predictedAwayGoals = mostLikelyResult === "away" ? 1 : 0;
      }

      console.log(`Score prédit: ${predictedHomeGoals}-${predictedAwayGoals}`);

      // Évaluer la qualité des données
      const dataQuality = evaluateDataQuality(
        homeStats.matchesPlayed,
        awayStats.matchesPlayed,
        h2hStats.matchesPlayed
      );

      // Retourner la prédiction
      return {
        match: {
          id: match._id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          startTime: match.startTime,
        },
        prediction: {
          homeWinProbability: normalizedHomeWinProb,
          drawProbability: drawProbability,
          awayWinProbability: normalizedAwayWinProb,
          predictedScore: {
            home: predictedHomeGoals,
            away: predictedAwayGoals,
          },
          mostLikelyResult: mostLikelyResult,
          confidence: Math.max(
            normalizedHomeWinProb,
            drawProbability,
            normalizedAwayWinProb
          ),
        },
        stats: {
          home: homeStats,
          away: awayStats,
          h2h: h2hStats,
        },
        dataQuality: dataQuality,
      };
    } catch (error) {
      console.error("Erreur lors de la prédiction:", error);
      throw error;
    }
  },

  // Synchroniser les données historiques pour toutes les équipes
  syncHistoricalMatches: async () => {
    try {
      // Récupérer tous les matchs à venir
      const upcomingMatches = await Match.find({ status: "scheduled" });

      // Extraire les équipes uniques
      const teams = new Set();
      upcomingMatches.forEach((match) => {
        teams.add(match.homeTeam);
        teams.add(match.awayTeam);
      });

      console.log(
        `Synchronisation des données historiques pour ${teams.size} équipes`
      );

      // Pour chaque équipe, récupérer son historique
      const results = [];
      for (const team of teams) {
        const matches = await matchHistoryService.fetchAndStoreTeamHistory(
          team
        );
        results.push({
          team,
          matchesAdded: matches.length,
        });

        // Pause pour éviter de surcharger l'API
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return {
        success: true,
        message: `Synchronisation terminée pour ${teams.size} équipes`,
        results,
      };
    } catch (error) {
      console.error("Erreur lors de la synchronisation:", error);
      return {
        success: false,
        message: "Erreur lors de la synchronisation",
        error: error.message,
      };
    }
  },
};

// Fonctions utilitaires pour les calculs de prédiction

// Calculer les statistiques d'une équipe
function calculateTeamStats(matches, teamName) {
  if (!matches || matches.length === 0) {
    console.log(`Aucun match trouvé pour l'équipe ${teamName}`);
    return {
      winRate: 0,
      avgGoalsScored: 0,
      avgGoalsConceded: 0,
      recentFormPoints: 0,
      matchesPlayed: 0,
    };
  }

  console.log(
    `Calcul des statistiques pour ${teamName} basé sur ${matches.length} matchs`
  );

  let wins = 0;
  let draws = 0;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let recentFormPoints = 0;

  // Calculer les statistiques sur tous les matchs
  matches.forEach((match, index) => {
    if (!match.result || typeof match.result !== "object") {
      console.log(`Match sans résultat valide: ${JSON.stringify(match)}`);
      return; // Ignorer ce match
    }

    const isHome = match.homeTeam === teamName;

    // Vérifier que les scores existent
    if (
      match.result.homeScore === undefined ||
      match.result.awayScore === undefined
    ) {
      console.log(`Match sans scores valides: ${JSON.stringify(match)}`);
      return; // Ignorer ce match
    }

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

  const validMatches = matches.filter(
    (m) =>
      m.result &&
      typeof m.result === "object" &&
      m.result.homeScore !== undefined &&
      m.result.awayScore !== undefined
  ).length;

  console.log(
    `${teamName}: ${wins} victoires, ${draws} nuls sur ${validMatches} matchs valides`
  );

  return {
    winRate: validMatches > 0 ? wins / validMatches : 0,
    avgGoalsScored: validMatches > 0 ? totalGoalsScored / validMatches : 0,
    avgGoalsConceded: validMatches > 0 ? totalGoalsConceded / validMatches : 0,
    recentFormPoints: Math.min(recentFormPoints, 15), // Maximum 15 points (5 victoires)
    matchesPlayed: validMatches,
  };
}

// Calculer les statistiques des confrontations directes
function calculateH2HStats(matches, homeTeam, awayTeam) {
  if (!matches || matches.length === 0) {
    console.log(
      `Aucune confrontation directe trouvée entre ${homeTeam} et ${awayTeam}`
    );
    return {
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      homeGoals: 0,
      awayGoals: 0,
      matchesPlayed: 0,
    };
  }

  console.log(
    `Calcul des statistiques H2H entre ${homeTeam} et ${awayTeam} basé sur ${matches.length} matchs`
  );

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let validMatches = 0;

  matches.forEach((match) => {
    // Vérifier que le match a un résultat valide
    if (
      !match.result ||
      typeof match.result !== "object" ||
      match.result.homeScore === undefined ||
      match.result.awayScore === undefined
    ) {
      console.log(`Match H2H sans résultat valide: ${JSON.stringify(match)}`);
      return; // Ignorer ce match
    }

    validMatches++;

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

  console.log(
    `H2H ${homeTeam} vs ${awayTeam}: ${homeWins} victoires domicile, ${awayWins} victoires extérieur, ${draws} nuls sur ${validMatches} matchs valides`
  );

  return {
    homeWins,
    awayWins,
    draws,
    homeGoals,
    awayGoals,
    matchesPlayed: validMatches,
  };
}

// Calculer la probabilité de victoire
function calculateWinProbability(teamStats, opponentStats, h2hStats, isHome) {
  // Facteurs de pondération
  const FORM_WEIGHT = 0.3;
  const WIN_RATE_WEIGHT = 0.3;
  const GOALS_WEIGHT = 0.2;
  const H2H_WEIGHT = 0.2;

  // Avantage du terrain
  const HOME_ADVANTAGE = isHome ? 0.1 : 0;

  // Calculer le score basé sur la forme récente (max 15 points)
  const formScore = teamStats.recentFormPoints / 15;

  // Calculer le score basé sur le taux de victoire
  const winRateScore = teamStats.winRate;

  // Calculer le score basé sur les buts (marqués vs concédés)
  const goalsDifference =
    teamStats.avgGoalsScored - opponentStats.avgGoalsConceded;
  const goalsScore = Math.max(0, Math.min(1, (goalsDifference + 2) / 4)); // Normaliser entre 0 et 1

  // Calculer le score basé sur les confrontations directes
  let h2hScore = 0;
  if (h2hStats.matchesPlayed > 0) {
    const winRate = isHome
      ? h2hStats.homeWins / h2hStats.matchesPlayed
      : h2hStats.awayWins / h2hStats.matchesPlayed;
    h2hScore = winRate;
  }

  // Calculer la probabilité finale
  const probability =
    formScore * FORM_WEIGHT +
    winRateScore * WIN_RATE_WEIGHT +
    goalsScore * GOALS_WEIGHT +
    h2hScore * H2H_WEIGHT +
    HOME_ADVANTAGE;

  return Math.min(0.9, Math.max(0.1, probability)); // Limiter entre 0.1 et 0.9
}

// Évaluer la qualité des données
function evaluateDataQuality(
  homeMatchesCount,
  awayMatchesCount,
  h2hMatchesCount
) {
  // Seuils pour une bonne qualité de données
  const GOOD_TEAM_HISTORY = 10;
  const GOOD_H2H_HISTORY = 3;

  // Calculer un score de qualité
  let qualityScore = 0;

  // Évaluer l'historique de l'équipe à domicile
  if (homeMatchesCount >= GOOD_TEAM_HISTORY) {
    qualityScore += 0.4;
  } else {
    qualityScore += 0.4 * (homeMatchesCount / GOOD_TEAM_HISTORY);
  }

  // Évaluer l'historique de l'équipe à l'extérieur
  if (awayMatchesCount >= GOOD_TEAM_HISTORY) {
    qualityScore += 0.4;
  } else {
    qualityScore += 0.4 * (awayMatchesCount / GOOD_TEAM_HISTORY);
  }

  // Évaluer l'historique des confrontations directes
  if (h2hMatchesCount >= GOOD_H2H_HISTORY) {
    qualityScore += 0.2;
  } else {
    qualityScore += 0.2 * (h2hMatchesCount / GOOD_H2H_HISTORY);
  }

  // Déterminer le niveau de qualité
  if (qualityScore >= 0.8) {
    return "high";
  } else if (qualityScore >= 0.5) {
    return "medium";
  } else {
    return "low";
  }
}

module.exports = predictionService;
