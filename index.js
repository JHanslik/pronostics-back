const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Chargement des variables d'environnement
dotenv.config();

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Connexion à MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connexion à MongoDB établie"))
  .catch((err) => console.error("Erreur de connexion à MongoDB:", err));

// Routes
const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/matches");
const pronosticRoutes = require("./routes/pronostics");
const userRoutes = require("./routes/users");

app.use("/api/auth", authRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/pronostics", pronosticRoutes);
app.use("/api/users", userRoutes);

// Route de base
app.get("/", (req, res) => {
  res.send("API Pronostics Sportifs");
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
