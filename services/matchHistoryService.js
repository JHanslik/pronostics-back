const axios = require("axios");
const Match = require("../models/Match");
const HistoricalMatch = require("../models/HistoricalMatch");
const footballApi = require("./footballApi");

// Compteur de requêtes API pour suivre l'utilisation
let apiRequestCount = 0;
const MAX_API_REQUESTS = 150; // Augmentation de la limite pour récupérer plus de données

const matchHistoryService = {
  // Récupérer et stocker l'historique des matchs pour une équipe
  fetchAndStoreTeamHistory: async (teamName) => {
    try {
      console.log(`Récupération de l'historique pour ${teamName}`);

      // Vérifier si nous avons déjà des matchs pour cette équipe
      const existingCount = await HistoricalMatch.countDocuments({
        $or: [{ homeTeam: teamName }, { awayTeam: teamName }],
      });

      // Augmenter le seuil pour récupérer plus de matchs
      if (existingCount >= 200) {
        console.log(
          `Déjà ${existingCount} matchs en base pour ${teamName}, pas besoin d'en récupérer plus`
        );
        return [];
      }

      // Vérifier si nous n'avons pas dépassé le quota d'API
      if (apiRequestCount >= MAX_API_REQUESTS) {
        console.log("Quota d'API atteint, arrêt des requêtes");
        return [];
      }

      // Récupérer les matchs depuis l'API externe avec historique étendu
      apiRequestCount++;
      const matches = await footballApi.getExtendedTeamHistory(teamName);

      console.log(`${matches.length} matchs trouvés pour ${teamName}`);

      // Récupérer tous les externalId existants en une seule requête
      const existingIds = new Set(
        (
          await HistoricalMatch.find(
            { externalId: { $in: matches.map((m) => m.externalId) } },
            "externalId"
          )
        ).map((doc) => doc.externalId)
      );

      // Filtrer les nouveaux matchs
      const newMatches = matches.filter(
        (match) => !existingIds.has(match.externalId)
      );

      // Insérer les nouveaux matchs en une seule opération
      if (newMatches.length > 0) {
        await HistoricalMatch.insertMany(
          newMatches.map((match) => ({
            externalId: match.externalId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            startTime: match.startTime,
            status: match.status,
            result: match.result,
          }))
        );
      }

      // Mettre à jour les matchs existants qui ont changé de statut
      const matchesToUpdate = matches.filter(
        (match) =>
          existingIds.has(match.externalId) && match.status === "finished"
      );

      for (const match of matchesToUpdate) {
        await HistoricalMatch.updateOne(
          { externalId: match.externalId, status: { $ne: "finished" } },
          {
            $set: {
              status: match.status,
              result: match.result,
            },
          }
        );
      }

      console.log(
        `${newMatches.length} nouveaux matchs ajoutés à la base pour ${teamName}`
      );
      console.log(
        `${matchesToUpdate.length} matchs existants mis à jour pour ${teamName}`
      );

      return matches;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération de l'historique pour ${teamName}:`,
        error
      );
      return [];
    }
  },

  // Récupérer et stocker les confrontations directes entre deux équipes
  fetchAndStoreH2HMatches: async (team1, team2) => {
    try {
      console.log(
        `Récupération des confrontations directes entre ${team1} et ${team2}`
      );

      // Récupérer les confrontations directes depuis l'API externe
      const matches = await footballApi.getExtendedH2HHistory(team1, team2);

      console.log(
        `${matches.length} confrontations directes trouvées entre ${team1} et ${team2}`
      );

      // Stocker chaque match dans la base de données
      let newMatchesCount = 0;
      for (const match of matches) {
        // Vérifier si le match existe déjà
        const existingMatch = await HistoricalMatch.findOne({
          externalId: match.externalId,
        });

        if (!existingMatch) {
          await HistoricalMatch.create({
            externalId: match.externalId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            startTime: match.startTime,
            status: match.status,
            result: match.result,
          });
          newMatchesCount++;
        }
      }

      console.log(
        `${newMatchesCount} nouvelles confrontations directes ajoutées à la base entre ${team1} et ${team2}`
      );

      return matches;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des confrontations directes entre ${team1} et ${team2}:`,
        error
      );
      return [];
    }
  },

  // Récupérer l'historique des matchs pour une équipe depuis la base de données locale
  getTeamHistory: async (teamName, limit = 200) => {
    // Augmentation de la limite par défaut
    try {
      // Récupérer les matchs de l'équipe depuis la base de données
      const matches = await HistoricalMatch.find({
        $or: [{ homeTeam: teamName }, { awayTeam: teamName }],
        status: "finished",
      })
        .sort({ startTime: -1 })
        .limit(limit);

      return matches;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération de l'historique pour ${teamName}:`,
        error
      );
      return [];
    }
  },

  // Récupérer les confrontations directes entre deux équipes
  getHeadToHeadMatches: async (team1, team2, limit = 20) => {
    // Augmentation de la limite
    try {
      // Récupérer les confrontations directes depuis la base de données
      const matches = await HistoricalMatch.find({
        $or: [
          { homeTeam: team1, awayTeam: team2 },
          { homeTeam: team2, awayTeam: team1 },
        ],
        status: "finished",
      })
        .sort({ startTime: -1 })
        .limit(limit);

      return matches;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des confrontations directes entre ${team1} et ${team2}:`,
        error
      );
      return [];
    }
  },

  // Synchroniser les matchs historiques de manière plus agressive
  syncHistoricalMatches: async () => {
    try {
      // Réinitialiser le compteur de requêtes
      apiRequestCount = 0;

      // Récupérer toutes les équipes uniques de nos matchs à venir
      const upcomingMatches = await Match.find();
      const teams = new Set();

      upcomingMatches.forEach((match) => {
        teams.add(match.homeTeam);
        teams.add(match.awayTeam);
      });

      console.log(`Synchronisation de l'historique pour ${teams.size} équipes`);

      // Récupérer les équipes qui ont le moins de matchs en base
      const teamsWithMatchCounts = await Promise.all(
        Array.from(teams).map(async (team) => {
          const count = await HistoricalMatch.countDocuments({
            $or: [{ homeTeam: team }, { awayTeam: team }],
          });
          return { team, count };
        })
      );

      // Trier les équipes par nombre de matchs (du moins au plus)
      teamsWithMatchCounts.sort((a, b) => a.count - b.count);

      // Traiter plus d'équipes par exécution
      const teamsToProcess = teamsWithMatchCounts
        .slice(0, 10) // Augmentation du nombre d'équipes traitées
        .map((t) => t.team);

      console.log(
        `Traitement de ${
          teamsToProcess.length
        } équipes prioritaires: ${teamsToProcess.join(", ")}`
      );

      // Pour chaque équipe prioritaire, récupérer et stocker son historique
      for (const team of teamsToProcess) {
        await matchHistoryService.fetchAndStoreTeamHistory(team);

        // Pause pour éviter de surcharger l'API
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Vérifier si nous avons atteint le quota
        if (apiRequestCount >= MAX_API_REQUESTS) {
          console.log("Quota d'API atteint, arrêt du traitement");
          break;
        }
      }

      // Récupérer également les confrontations directes pour les matchs à venir
      const upcomingPairs = [];
      upcomingMatches.forEach((match) => {
        upcomingPairs.push({
          team1: match.homeTeam,
          team2: match.awayTeam,
        });
      });

      // Limiter le nombre de paires à traiter
      const pairsToProcess = upcomingPairs.slice(0, 5);

      for (const pair of pairsToProcess) {
        if (apiRequestCount >= MAX_API_REQUESTS) break;

        await matchHistoryService.fetchAndStoreH2HMatches(
          pair.team1,
          pair.team2
        );

        // Pause pour éviter de surcharger l'API
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Compter le nombre total de matchs historiques
      const totalHistoricalMatches = await HistoricalMatch.countDocuments();
      const processedTeams = teamsToProcess.length;

      return {
        success: true,
        message: `Historique synchronisé pour ${processedTeams} équipes et ${pairsToProcess.length} confrontations directes. Total de ${totalHistoricalMatches} matchs historiques en base. ${apiRequestCount} requêtes API utilisées.`,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la synchronisation de l'historique:",
        error
      );
      return { success: false, message: error.message };
    }
  },
};

module.exports = matchHistoryService;
