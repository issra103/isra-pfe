const express = require('express');
const router  = express.Router();
const path    = require('path');
const { execFile } = require('child_process');
const { getLatest, getKPIs, getMonthlyKPIs, getAnomalies, getMonthlyReport, getZonesDetail, getPredictions } = require('../controllers/energy.controller');

const VENV_PYTHON = path.join(__dirname, '../../../ai_service/venv/bin/python');
const ANOMALIES_SCRIPT = path.join(__dirname, '../../../ai_service/anomalies.py');

router.get('/latest',      getLatest);
router.get('/kpis',        getKPIs);
router.get('/monthly',     getMonthlyKPIs);
router.get('/anomalies/history', (req, res) => {
  execFile(VENV_PYTHON, [ANOMALIES_SCRIPT], { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    try {
      res.json(JSON.parse(stdout));
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON from anomalies script' });
    }
  });
});
router.get('/anomalies',   getAnomalies);
router.get('/reports',     getMonthlyReport);
router.get('/zones',       getZonesDetail);
router.get('/predictions', getPredictions);

module.exports = router;
