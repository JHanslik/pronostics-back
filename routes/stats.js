const express = require("express");
const router = express.Router();
const { getGlobalStats } = require("../controllers/statsController");

router.get("/", getGlobalStats);

module.exports = router;
