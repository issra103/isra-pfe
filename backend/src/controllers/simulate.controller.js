const { spawn }  = require('child_process');
const path       = require('path');

const SIMULATOR_SCRIPT = path.join(__dirname, '../../../../isra/simulator/simulator.py');
const VENV_PYTHON      = 'python'; // Utilise le python du système sur Windows

let simulatorProcess = null;

exports.getStatus = (req, res) => {
  res.json({ running: simulatorProcess !== null, pid: simulatorProcess?.pid ?? null });
};

exports.startSimulator = (req, res) => {
  if (simulatorProcess) {
    return res.status(409).json({ error: 'Simulateur déjà en cours', pid: simulatorProcess.pid });
  }

  simulatorProcess = spawn(VENV_PYTHON, [SIMULATOR_SCRIPT], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  simulatorProcess.stdout.on('data', (d) => process.stdout.write(`[SIM] ${d}`));
  simulatorProcess.stderr.on('data', (d) => process.stderr.write(`[SIM ERR] ${d}`));

  simulatorProcess.on('exit', (code) => {
    console.log(`[SIM] Processus terminé (code ${code})`);
    simulatorProcess = null;
    // Notify frontend via socket
    req.app.get('io')?.emit('simulator_status', { running: false });
  });

  req.app.get('io')?.emit('simulator_status', { running: true, pid: simulatorProcess.pid });
  res.status(201).json({ started: true, pid: simulatorProcess.pid });
};

exports.stopSimulator = (req, res) => {
  if (!simulatorProcess) {
    return res.status(404).json({ error: 'Simulateur non actif' });
  }

  simulatorProcess.kill('SIGTERM');
  simulatorProcess = null;
  req.app.get('io')?.emit('simulator_status', { running: false });
  res.json({ stopped: true });
};
