# ÉTAPE 4 — Calcul Financier (Watts → Dinars Tunisiens)

> **Objectif :** Convertir chaque lecture de puissance instantanée (Watts) en énergie consommée (kWh) puis en coût réel (DT), en appliquant les tarifs STEG selon la tranche horaire.

---

## 🧠 Logique de Calcul

```
Puissance reçue (W)  +  Intervalle de temps (10s)
              │
              ▼
     Énergie (kWh) = P(W) × Δt(h)
     Δt = 10s ÷ 3600 = 0.002778 h
              │
              ▼
     Heure de la mesure → Heure Pleine ou Heure Creuse ?
              │
        ┌─────┴──────┐
     HP (0.250 DT)  HC (0.150 DT)
        └─────┬──────┘
              ▼
     Coût (DT) = Énergie (kWh) × Tarif (DT/kWh)
              │
              ▼
     Sauvegarde MongoDB + Agrégation journalière
```

### Formule exacte

$$
E_{kWh} = P_W \times \frac{\Delta t}{3600}
$$

$$
Coût_{DT} = E_{kWh} \times Tarif_{DT/kWh}
$$

Avec $\Delta t = 10$ secondes (intervalle du simulateur).

---

## 📦 Structure des fichiers concernés

```
backend/
├── src/
│   ├── services/
│   │   └── financial.service.js     ← Logique de calcul
│   ├── models/
│   │   └── Tariff.js                ← Schéma des tarifs en base
│   └── scripts/
│       └── seed-tariffs.js          ← Script d'initialisation des tarifs
```

---

## 🗄️ Modèle Mongoose — `backend/src/models/Tariff.js`

*(Déjà défini à l'étape 2 — rappel complet ici)*

```javascript
const mongoose = require('mongoose');

const tariffSchema = new mongoose.Schema({
  name:         { type: String, required: true },   // "STEG Basse Tension 2026"
  heure_pleine: { type: Number, required: true },   // DT / kWh
  heure_creuse: { type: Number, required: true },   // DT / kWh
  peak_hours: {
    start: { type: Number, default: 8  },   // 08h00 → Heure Pleine
    end:   { type: Number, default: 22 },   // 22h00 → Heure Creuse après 22h
  },
  is_active:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Tariff', tariffSchema);
```

---

## 🌱 Script d'initialisation — `backend/src/scripts/seed-tariffs.js`

> Exécuter **une seule fois** pour insérer le tarif STEG initial en base.

```javascript
require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const Tariff   = require('../models/Tariff');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Seed] Connecté à MongoDB');

  // Supprimer l'ancien tarif actif si existant
  await Tariff.deleteMany({});

  const tariff = new Tariff({
    name:         'STEG Basse Tension 2026',
    heure_pleine: 0.250,   // 0.250 DT par kWh (08h → 22h)
    heure_creuse: 0.150,   // 0.150 DT par kWh (22h → 08h)
    peak_hours: { start: 8, end: 22 },
    is_active:    true,
  });

  await tariff.save();
  console.log('[Seed] Tarif créé :', tariff.toObject());

  await mongoose.disconnect();
  console.log('[Seed] Terminé.');
}

seed().catch(console.error);
```

```bash
# Commande d'exécution (depuis le dossier backend/)
node src/scripts/seed-tariffs.js
```

---

## ⚙️ Service Financier — `backend/src/services/financial.service.js`

```javascript
const Tariff = require('../models/Tariff');

// Intervalle d'envoi du simulateur en secondes
const SIMULATOR_INTERVAL_S = 10;

/**
 * Détermine si un timestamp tombe en Heure Pleine ou Heure Creuse.
 * @param {Date}   timestamp  - Heure de la mesure
 * @param {object} tariff     - Document Tariff Mongoose
 * @returns {{ tariffType: string, ratePerKwh: number }}
 */
function getTariffType(timestamp, tariff) {
  const hour = new Date(timestamp).getHours();
  const isPeak = hour >= tariff.peak_hours.start && hour < tariff.peak_hours.end;
  return {
    tariffType:  isPeak ? 'heure_pleine' : 'heure_creuse',
    ratePerKwh:  isPeak ? tariff.heure_pleine : tariff.heure_creuse,
  };
}

/**
 * Calcule l'énergie (kWh) et le coût (DT) pour une lecture de capteur.
 * @param {number} power_w    - Puissance instantanée en Watts
 * @param {Date}   timestamp  - Horodatage de la mesure
 * @returns {{ energy_kwh: number, cost_dt: number, tariff_type: string }}
 */
exports.calculateCost = async (power_w, timestamp) => {
  // Récupérer le tarif actif depuis MongoDB
  const tariff = await Tariff.findOne({ is_active: true }).lean();

  if (!tariff) {
    throw new Error('Aucun tarif actif trouvé en base. Lance seed-tariffs.js');
  }

  // Énergie = Puissance × Temps
  const delta_h   = SIMULATOR_INTERVAL_S / 3600;         // 10s → heures
  const energy_kwh = (power_w / 1000) * delta_h;         // W → kW × h = kWh

  // Tarif selon l'heure
  const { tariffType, ratePerKwh } = getTariffType(timestamp, tariff);

  // Coût
  const cost_dt = energy_kwh * ratePerKwh;

  return {
    energy_kwh:  parseFloat(energy_kwh.toFixed(6)),
    cost_dt:     parseFloat(cost_dt.toFixed(6)),
    tariff_type: tariffType,
  };
};
```

---

## 📊 Exemple de calcul pas-à-pas

**Scénario :** Zone1 envoie 29 000 W à 14h00 (Heure Pleine).

| Étape                | Calcul                                     | Résultat        |
|----------------------|--------------------------------------------|-----------------|
| Intervalle           | $\Delta t = 10 \div 3600$                  | 0.002778 h      |
| Énergie              | $(29000 \div 1000) \times 0.002778$        | 0.080556 kWh    |
| Tarif HP             | 0.250 DT/kWh                              | —               |
| **Coût**             | $0.080556 \times 0.250$                    | **0.020139 DT** |

> Sur 24h (8 640 lectures), la Zone1 coûterait approximativement **174 DT/jour** en HP continu.

---

## ✅ Validation de l'Étape 4

### Test 1 — Vérification manuelle (Excel)

Simule 6 lectures consécutives à 14h00 (HP), toutes à **29 000 W** :

| Lecture | Power (W) | Δt (h)   | Énergie (kWh) | Tarif HP (DT/kWh) | Coût (DT)  |
|---------|-----------|----------|---------------|--------------------|------------|
| 1       | 29 000    | 0.002778 | 0.080556      | 0.250              | 0.020139   |
| 2       | 29 000    | 0.002778 | 0.080556      | 0.250              | 0.020139   |
| 3       | 29 000    | 0.002778 | 0.080556      | 0.250              | 0.020139   |
| 4       | 29 000    | 0.002778 | 0.080556      | 0.250              | 0.020139   |
| 5       | 29 000    | 0.002778 | 0.080556      | 0.250              | 0.020139   |
| 6       | 29 000    | 0.002778 | 0.080556      | 0.250              | 0.020139   |
| **Total** | —       | —        | **0.483333**  | —                  | **0.120833 DT** |

→ Comparer ce total avec `db.sensor_data.aggregate([{ $group: { _id: null, total: { $sum: "$cost_dt" } } }])` sur les 6 premiers documents.

### Test 2 — Vérification Heure Creuse

Envoie une requête Postman à **23h00** (Heure Creuse) avec 20 000 W :

```
Énergie = (20000 / 1000) × (10 / 3600) = 0.055556 kWh
Coût    = 0.055556 × 0.150             = 0.008333 DT
```

Vérifier en base que `tariff_type = "heure_creuse"` et `cost_dt ≈ 0.008333`.

### Test 3 — API de vérification

```bash
curl http://localhost:4000/api/energy/kpis
```

**Réponse attendue après 10 minutes de simulation (~60 lectures × 3 capteurs) :**
```json
{
  "total_kwh":     0.583,
  "total_cost_dt": 0.146,
  "anomaly_count": 4,
  "avg_power_w":   25340.2,
  "readings":      180
}
```

### ✔️ Critères de validation

| Critère                                      | Vérifié par                        |
|----------------------------------------------|------------------------------------|
| Tarif présent dans MongoDB après seed        | `db.tariffs.find()`                |
| `energy_kwh` et `cost_dt` non nuls en base  | MongoDB Compass                    |
| Calcul HP correspond au calcul Excel         | Comparaison manuelle               |
| Calcul HC correspond au calcul Excel         | Postman + calcul manuel            |
| `tariff_type` = `"heure_creuse"` la nuit     | Inspecter documents en base        |
| KPIs s'accumulent au fil du temps            | Appel GET /api/energy/kpis répété  |

---

## 🐛 Dépannage

| Erreur                                       | Solution                                            |
|----------------------------------------------|-----------------------------------------------------|
| `Aucun tarif actif trouvé`                   | Lancer `node src/scripts/seed-tariffs.js`           |
| `cost_dt` toujours `null` en base            | Vérifier que `setImmediate` s'exécute (logs async)  |
| Coût ne correspond pas au calcul Excel        | Vérifier `SIMULATOR_INTERVAL_S = 10` dans le service|
| Tarif HP appliqué à 23h                      | Vérifier `peak_hours.end = 22` dans MongoDB         |

---

## 🔜 Prochaine étape

➡️ [STEP5 — Frontend React.js Dashboard](./STEP5_Frontend.md)
