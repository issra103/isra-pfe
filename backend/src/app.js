const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const iotRoutes      = require('./routes/iot.routes');
const energyRoutes   = require('./routes/energy.routes');
const simulateRoutes = require('./routes/simulate.routes');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.set('io', io);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/iot',      iotRoutes);
app.use('/api/energy',   energyRoutes);
app.use('/api/simulate', simulateRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('[DB] MongoDB connecte'))
  .catch(err => { console.error('[DB] Erreur :', err.message); process.exit(1); });

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connecte : ${socket.id}`);
  socket.on('disconnect', () => console.log(`[Socket] Deconnecte : ${socket.id}`));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[API] Serveur sur http://localhost:${PORT}`));
