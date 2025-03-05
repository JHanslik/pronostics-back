const axios = require("axios");

// TheSportsDB API (version gratuite)
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

const footballApi = {
  // Récupérer les matchs à venir
  getUpcomingMatches: async () => {
    try {
      // Utiliser l'endpoint pour les événements à venir dans une ligue
      // Ligue 1 = 4334 (vérifiez l'ID correct dans la documentation)
      const response = await axios.get(
        `${BASE_URL}/eventsnextleague.php?id=4334`
      );

      if (!response.data || !response.data.events) {
        console.log(
          "Aucun match à venir trouvé ou format de réponse incorrect"
        );
        return [];
      }

      // Transformer les données pour notre format
      return response.data.events.map((match) => ({
        externalId: match.idEvent,
        homeTeam: match.strHomeTeam,
        awayTeam: match.strAwayTeam,
        league: match.strLeague,
        startTime: new Date(
          match.strTimestamp || match.dateEvent + "T" + match.strTime
        ),
        status: "scheduled",
      }));
    } catch (error) {
      console.error("Erreur lors de la récupération des matchs:", error);

      // Retourner un tableau vide en cas d'erreur pour éviter de bloquer l'application
      return [];
    }
  },

  // Récupérer les résultats des matchs
  getMatchResults: async () => {
    try {
      // Utiliser l'endpoint pour les événements passés dans une ligue
      const response = await axios.get(
        `${BASE_URL}/eventspastleague.php?id=4334`
      );

      if (!response.data || !response.data.events) {
        console.log("Aucun résultat trouvé ou format de réponse incorrect");
        return [];
      }

      // Transformer les données pour notre format
      return response.data.events.map((match) => {
        const homeScore = parseInt(match.intHomeScore) || 0;
        const awayScore = parseInt(match.intAwayScore) || 0;

        let winner = null;
        if (homeScore > awayScore) {
          winner = "home";
        } else if (awayScore > homeScore) {
          winner = "away";
        } else {
          winner = "draw";
        }

        return {
          externalId: match.idEvent,
          homeTeam: match.strHomeTeam,
          awayTeam: match.strAwayTeam,
          league: match.strLeague,
          startTime: new Date(
            match.strTimestamp || match.dateEvent + "T" + match.strTime
          ),
          status: "finished",
          result: {
            homeScore,
            awayScore,
            winner,
          },
        };
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des résultats:", error);
      return [];
    }
  },

  // Méthode pour récupérer les ligues disponibles (utile pour déboguer)
  getAllLeagues: async () => {
    try {
      const response = await axios.get(`${BASE_URL}/all_leagues.php`);
      return response.data.leagues || [];
    } catch (error) {
      console.error("Erreur lors de la récupération des ligues:", error);
      return [];
    }
  },

  // Récupérer un historique étendu des matchs pour une équipe
  getExtendedTeamHistory: async (teamName) => {
    try {
      console.log(`Récupération de l'historique étendu pour ${teamName}`);

      // Récupérer les matchs de la saison actuelle
      const currentSeasonResponse = await axios.get(
        `${BASE_URL}/searchevents.php?e=${encodeURIComponent(teamName)}`
      );

      let allMatches = [];

      if (currentSeasonResponse.data && currentSeasonResponse.data.event) {
        allMatches = [...currentSeasonResponse.data.event];
      }

      // Récupérer les matchs de la saison précédente
      // Note: Pour la Ligue 1, les saisons sont au format "2023-2024"
      const previousSeasons = ["2022-2023", "2021-2022", "2020-2021"];

      for (const season of previousSeasons) {
        try {
          // Récupérer les matchs de la saison spécifique pour cette équipe
          const seasonResponse = await axios.get(
            `${BASE_URL}/searchevents.php?e=${encodeURIComponent(
              teamName
            )}&s=${season}`
          );

          if (seasonResponse.data && seasonResponse.data.event) {
            allMatches = [...allMatches, ...seasonResponse.data.event];
            console.log(
              `Ajout de ${seasonResponse.data.event.length} matchs de la saison ${season} pour ${teamName}`
            );
          }

          // Pause pour éviter de surcharger l'API
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(
            `Erreur lors de la récupération des matchs de la saison ${season} pour ${teamName}:`,
            error
          );
        }
      }

      // Filtrer pour ne garder que les matchs terminés
      const finishedMatches = allMatches.filter(
        (match) => match.strStatus === "Match Finished"
      );

      console.log(
        `Total de ${finishedMatches.length} matchs terminés trouvés pour ${teamName}`
      );

      // Transformer les données pour notre format
      return finishedMatches.map((match) => {
        const homeScore = parseInt(match.intHomeScore) || 0;
        const awayScore = parseInt(match.intAwayScore) || 0;

        let winner = null;
        if (homeScore > awayScore) {
          winner = "home";
        } else if (awayScore > homeScore) {
          winner = "away";
        } else {
          winner = "draw";
        }

        return {
          externalId: match.idEvent,
          homeTeam: match.strHomeTeam,
          awayTeam: match.strAwayTeam,
          league: match.strLeague,
          startTime: new Date(
            match.dateEvent + "T" + (match.strTime || "00:00:00")
          ),
          status: "finished",
          result: {
            homeScore,
            awayScore,
            winner,
          },
        };
      });
    } catch (error) {
      console.error(
        `Erreur lors de la récupération de l'historique étendu pour ${teamName}:`,
        error
      );
      return [];
    }
  },

  // Récupérer un historique étendu des confrontations directes
  getExtendedH2HHistory: async (team1, team2) => {
    try {
      console.log(
        `Récupération des confrontations directes étendues entre ${team1} et ${team2}`
      );

      // Récupérer les matchs de team1 et filtrer ceux contre team2
      const team1Matches = await footballApi.getExtendedTeamHistory(team1);
      const h2hMatches1 = team1Matches.filter(
        (match) => match.homeTeam === team2 || match.awayTeam === team2
      );

      // Récupérer les matchs de team2 et filtrer ceux contre team1
      // (pour être sûr de ne rien manquer)
      const team2Matches = await footballApi.getExtendedTeamHistory(team2);
      const h2hMatches2 = team2Matches.filter(
        (match) => match.homeTeam === team1 || match.awayTeam === team1
      );

      // Fusionner les deux ensembles de matchs et éliminer les doublons
      const allH2HMatches = [...h2hMatches1];

      // Ajouter les matchs de h2hMatches2 qui ne sont pas déjà dans allH2HMatches
      for (const match2 of h2hMatches2) {
        if (
          !allH2HMatches.some(
            (match1) => match1.externalId === match2.externalId
          )
        ) {
          allH2HMatches.push(match2);
        }
      }

      console.log(
        `Total de ${allH2HMatches.length} confrontations directes trouvées entre ${team1} et ${team2}`
      );

      return allH2HMatches;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des confrontations directes étendues entre ${team1} et ${team2}:`,
        error
      );
      return [];
    }
  },
};

module.exports = footballApi;
