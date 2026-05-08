const express = require('express');
const router  = express.Router();
const { getStatus, startSimulator, stopSimulator } = require('../controllers/simulate.controller');

router.get('/status',  getStatus);
router.post('/start',  startSimulator);
router.post('/stop',   stopSimulator);

module.exports = router;
