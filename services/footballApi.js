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
};

module.exports = footballApi;
