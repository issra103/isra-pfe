# ÉTAPE 2 — Backend Node.js + Express

> **Objectif :** Créer une API REST sécurisée qui reçoit les données IoT, les sauvegarde dans MongoDB, déclenche l'analyse IA, et calcule les coûts financiers en temps réel.

---

## 🧠 Logique du Backend

```
POST /api/iot/data  ←── Simulateur IoT
      │
      ├── 1. Validation des données (format + champs requis)
      ├── 2. Sauvegarde dans MongoDB (collection: sensor_data)
      ├── 3. Appel asynchrone → API FastAPI (analyse IA)
      │         └── Retourne: { is_anomaly, predicted_next_hour }
      ├── 4. Calcul du coût financier (Watts → DT)
      ├── 5. Mise à jour du document en base (coût + statut anomalie)
      └── 6. Émission Socket.io → Dashboard React.js (temps réel)
```

---

## 📦 Structure des fichiers

```
backend/
├── src/
│   ├── routes/
│   │   ├── iot.routes.js          ← POST /api/iot/data
│   │   ├── energy.routes.js       ← GET /api/energy/latest, GET /api/kpis
│   │   └── simulate.routes.js     ← POST /api/simulate (start/stop)
│   ├── controllers/
│   │   ├── iot.controller.js      ← Reçoit + sauvegarde les données IoT
│   │   ├── energy.controller.js   ← Retourne les données au frontend
│   │   └── financial.controller.js← Calculs financiers
│   ├── services/
│   │   ├── financial.service.js   ← Logique Watts → kWh → DT
│   │   └── ai.service.js          ← Appel HTTP vers FastAPI
│   ├── models/
│   │   ├── SensorData.js          ← Schéma Mongoose
│   │   └── Tariff.js              ← Schéma tarifs STEG
│   ├── middleware/
│   │   └── validate.js            ← Validation des requêtes entrantes
│   └── app.js                     ← Point d'entrée
├── .env
└── package.json
```

---

## 📋 `backend/package.json`

```json
{
  "name": "energywatch-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.3.4",
    "axios": "^1.6.8",
    "socket.io": "^4.7.5",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

---

## ⚙️ `backend/.env`

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/energywatch
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

---

## 🗄️ Modèles Mongoose

### `backend/src/models/SensorData.js`

```javascript
const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  timestamp:        { type: Date, required: true },
  sensor_id:        { type: String, required: true, index: true },
  batiment_id:      { type: String, required: true },
  type_equipement:  { type: String, enum: ['Climatisation', 'Serveur', 'Éclairage'], required: true },
  zone:             { type: String, required: true },
  power_w:          { type: Number, required: true, min: 0 },
  temperature:      { type: Number },
  humidity:         { type: Number },
  wind_speed:       { type: Number },
  // ─── Résultats IA ───────────────────────────────
  is_anomaly:       { type: Boolean, default: false },
  predicted_next_w: { type: Number, default: null },
  // ─── Calcul financier ──────────────────────────
  energy_kwh:       { type: Number, default: null },
  cost_dt:          { type: Number, default: null },
  tariff_type:      { type: String, enum: ['heure_pleine', 'heure_creuse'], default: null },
}, {
  timestamps: true   // ajoute createdAt / updatedAt automatiquement
});

// Index composé pour les requêtes analytiques
sensorDataSchema.index({ sensor_id: 1, timestamp: -1 });
sensorDataSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
```

### `backend/src/models/Tariff.js`

```javascript
const mongoose = require('mongoose');

const tariffSchema = new mongoose.Schema({
  name:         { type: String, required: true },  // "STEG Basse Tension 2026"
  heure_pleine: { type: Number, required: true },  // DT / kWh
  heure_creuse: { type: Number, required: true },  // DT / kWh
  peak_hours: {
    start: { type: Number, default: 8 },   // 08h00
    end:   { type: Number, default: 22 },  // 22h00
  },
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Tariff', tariffSchema);
```

---

## 🛣️ Routes & Contrôleurs

### `backend/src/routes/iot.routes.js`

```javascript
const express = require('express');
const router  = express.Router();
const { receiveData } = require('../controllers/iot.controller');
const { validateIoTPayload } = require('../middleware/validate');

router.post('/data', validateIoTPayload, receiveData);

module.exports = router;
```

### `backend/src/controllers/iot.controller.js`

```javascript
const SensorData = require('../models/SensorData');
const { analyzeWithAI } = require('../services/ai.service');
const { calculateCost } = require('../services/financial.service');

exports.receiveData = async (req, res) => {
  try {
    // 1. Créer le document initial
    const doc = new SensorData({
      timestamp:       new Date(req.body.timestamp),
      sensor_id:       req.body.sensor_id,
      batiment_id:     req.body.batiment_id,
      type_equipement: req.body.type_equipement,
      zone:            req.body.zone,
      power_w:         req.body.power_w,
      temperature:     req.body.temperature,
      humidity:        req.body.humidity,
      wind_speed:      req.body.wind_speed,
    });

    await doc.save();
    console.log(`[IoT] Reçu : ${doc.sensor_id} | ${doc.power_w} W`);

    // Répondre immédiatement (ne pas bloquer le simulateur)
    res.status(201).json({ success: true, id: doc._id });

    // 2. Traitement asynchrone (sans bloquer la réponse)
    setImmediate(async () => {
      try {
        // Appel IA
        const aiResult = await analyzeWithAI({
          power_w:     doc.power_w,
          temperature: doc.temperature,
          humidity:    doc.humidity,
          hour:        new Date(doc.timestamp).getHours(),
        });

        // Calcul financier
        const financial = await calculateCost(doc.power_w, doc.timestamp);

        // Mise à jour du document
        await SensorData.findByIdAndUpdate(doc._id, {
          is_anomaly:       aiResult.is_anomaly,
          predicted_next_w: aiResult.predicted_next_hour,
          energy_kwh:       financial.energy_kwh,
          cost_dt:          financial.cost_dt,
          tariff_type:      financial.tariff_type,
        });

        // 3. Émission Socket.io
        const io = req.app.get('io');
        io.emit('new_reading', {
          ...doc.toObject(),
          is_anomaly:       aiResult.is_anomaly,
          predicted_next_w: aiResult.predicted_next_hour,
          energy_kwh:       financial.energy_kwh,
          cost_dt:          financial.cost_dt,
        });

        if (aiResult.is_anomaly) {
          console.warn(`🚨 [ANOMALIE] ${doc.sensor_id} | ${doc.power_w} W`);
          io.emit('anomaly_detected', {
            sensor_id:   doc.sensor_id,
            batiment_id: doc.batiment_id,
            power_w:     doc.power_w,
            timestamp:   doc.timestamp,
          });
        }
      } catch (err) {
        console.error('[Async Error]', err.message);
      }
    });

  } catch (err) {
    console.error('[IoT Controller Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
```

### `backend/src/routes/energy.routes.js`

```javascript
const express = require('express');
const router  = express.Router();
const { getLatest, getKPIs, getAnomalies } = require('../controllers/energy.controller');

router.get('/latest',    getLatest);    // GET /api/energy/latest
router.get('/kpis',      getKPIs);      // GET /api/energy/kpis
router.get('/anomalies', getAnomalies); // GET /api/energy/anomalies

module.exports = router;
```

### `backend/src/controllers/energy.controller.js`

```javascript
const SensorData = require('../models/SensorData');

// Retourne les 50 dernières lectures
exports.getLatest = async (req, res) => {
  const data = await SensorData
    .find()
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();
  res.json(data);
};

// KPIs du jour
exports.getKPIs = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await SensorData.aggregate([
    { $match: { timestamp: { $gte: today } } },
    {
      $group: {
        _id:           null,
        total_kwh:     { $sum: '$energy_kwh' },
        total_cost_dt: { $sum: '$cost_dt' },
        anomaly_count: { $sum: { $cond: ['$is_anomaly', 1, 0] } },
        avg_power_w:   { $avg: '$power_w' },
        readings:      { $sum: 1 },
      }
    }
  ]);

  res.json(result[0] || { total_kwh: 0, total_cost_dt: 0, anomaly_count: 0 });
};

// Anomalies récentes
exports.getAnomalies = async (req, res) => {
  const anomalies = await SensorData
    .find({ is_anomaly: true })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();
  res.json(anomalies);
};
```

### `backend/src/middleware/validate.js`

```javascript
const { body, validationResult } = require('express-validator');

exports.validateIoTPayload = [
  body('sensor_id').notEmpty().isString(),
  body('batiment_id').notEmpty().isString(),
  body('type_equipement').isIn(['Climatisation', 'Serveur', 'Éclairage']),
  body('power_w').isFloat({ min: 0 }),
  body('timestamp').isISO8601(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

---

## 🚀 `backend/src/app.js`

```javascript
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const iotRoutes    = require('./routes/iot.routes');
const energyRoutes = require('./routes/energy.routes');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: process.env.FRONTEND_URL } });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.set('io', io);  // injecter io dans les contrôleurs

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/iot',    iotRoutes);
app.use('/api/energy', energyRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── MongoDB ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(`[DB] MongoDB connecté`))
  .catch(err => { console.error('[DB] Erreur :', err); process.exit(1); });

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connecté : ${socket.id}`);
  socket.on('disconnect', () => console.log(`[Socket] Déconnecté : ${socket.id}`));
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[API] Serveur démarré sur http://localhost:${PORT}`));
```

---

## ✅ Validation de l'Étape 2

### Test 1 — Postman : POST /api/iot/data

**Requête valide :**
```json
POST http://localhost:4000/api/iot/data
Content-Type: application/json

{
  "timestamp":       "2026-05-05T14:00:00.000Z",
  "sensor_id":       "S-001",
  "batiment_id":     "Zone1",
  "type_equipement": "Climatisation",
  "zone":            "Zone1",
  "power_w":         29000,
  "temperature":     22.5,
  "humidity":        60,
  "wind_speed":      0.1
}
```
**Réponse attendue :** `201 Created` + `{ "success": true, "id": "..." }`

**Requête invalide (champ manquant) :**
```json
{ "sensor_id": "S-001" }
```
**Réponse attendue :** `400 Bad Request` + liste des erreurs de validation

### Test 2 — GET /api/energy/latest

```bash
curl http://localhost:4000/api/energy/latest
```
**Attendu :** Tableau des 50 derniers documents avec tous les champs remplis.

### Test 3 — GET /api/energy/kpis

```bash
curl http://localhost:4000/api/energy/kpis
```
**Attendu :**
```json
{
  "total_kwh":     142.5,
  "total_cost_dt": 35.63,
  "anomaly_count": 3,
  "avg_power_w":   22456
}
```

### Test 4 — Socket.io

Ouvre la console du navigateur sur `http://localhost:3000` et vérifie :
```javascript
socket.on('new_reading', data => console.log(data));
// Toutes les 10s : un nouvel objet doit apparaître
```

### ✔️ Critères de validation

| Critère                              | Vérifié par                          |
|--------------------------------------|--------------------------------------|
| `201` sur données valides            | Postman                              |
| `400` sur données invalides          | Postman (champ manquant)             |
| Document en MongoDB avec bon format  | MongoDB Compass                      |
| GET /latest retourne les données     | curl / Postman                       |
| Socket.io émet `new_reading`         | Console browser                      |

---

## 🐛 Dépannage

| Erreur                          | Solution                                               |
|---------------------------------|--------------------------------------------------------|
| `ECONNREFUSED 27017`            | MongoDB n'est pas démarré (`mongod`)                   |
| `Cannot read properties of...`  | Vérifier que `io` est bien injecté via `app.set`       |
| `CORS Error`                    | Vérifier `FRONTEND_URL` dans `.env`                    |
| `ValidationError`               | Champ mal typé (ex: string à la place de float)        |

---

## 🔜 Prochaine étape

➡️ [STEP3 — Cerveau IA (FastAPI + ML)](./STEP3_AI_Brain.md)
