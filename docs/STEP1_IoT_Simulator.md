# ÉTAPE 1 — Simulateur IoT (Générateur de Données)

> **Objectif :** Lire le dataset CSV, ajouter du bruit réaliste, injecter des anomalies volontaires, et envoyer les données au backend Node.js toutes les 10 secondes.

---

## 🧠 Logique du Simulateur

```
CSV Dataset
    │
    ▼
Lecture ligne par ligne (boucle)
    │
    ├── + Bruit gaussien (±5% de la valeur)       ← Simule les fluctuations réelles
    ├── + Métadonnées (sensor_id, batiment_id)    ← Contexte de l'équipement
    └── Injection aléatoire d'anomalies (~2%)     ← Pour tester la détection IA
         │
         ▼
    POST /api/iot/data  (toutes les 10 secondes)
         │
         ▼
    Backend Node.js
```

---

## 📦 Structure des fichiers

```
simulator/
├── simulator.py        ← Script principal
└── requirements.txt    ← Dépendances Python
```

---

## 💻 Code — `simulator/simulator.py`

```python
import pandas as pd
import numpy as np
import requests
import time
import random
from datetime import datetime, timezone

# ─── Configuration ────────────────────────────────────────────────────────────
BACKEND_URL = "http://localhost:4000/api/iot/data"
CSV_PATH    = "../powerconsumption (12).csv"
INTERVAL_S  = 10          # secondes entre chaque envoi
ANOMALY_RATE = 0.02       # 2% des lignes = anomalie injectée

# ─── Métadonnées des capteurs ─────────────────────────────────────────────────
SENSORS = [
    {"sensor_id": "S-001", "batiment_id": "Zone1", "zone": "Zone1", "type_equipement": "Climatisation"},
    {"sensor_id": "S-002", "batiment_id": "Zone2", "zone": "Zone2", "type_equipement": "Serveur"},
    {"sensor_id": "S-003", "batiment_id": "Zone3", "zone": "Zone3", "type_equipement": "Éclairage"},
]

def add_noise(value: float, noise_pct: float = 0.05) -> float:
    """Ajoute un bruit gaussien de ±noise_pct% à la valeur."""
    noise = np.random.normal(0, value * noise_pct)
    return max(0, value + noise)

def inject_anomaly(value: float) -> float:
    """Retourne une valeur anormalement haute (pic simulé)."""
    return value * random.uniform(8, 15)   # 8x à 15x la valeur normale

def build_payload(row: pd.Series, sensor: dict) -> dict:
    """Construit le document JSON à envoyer au backend."""
    zone_col = f"PowerConsumption_{sensor['zone']}"
    raw_value = float(row[zone_col])

    is_anomaly = random.random() < ANOMALY_RATE
    power_w = inject_anomaly(raw_value) if is_anomaly else add_noise(raw_value)

    return {
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "sensor_id":       sensor["sensor_id"],
        "batiment_id":     sensor["batiment_id"],
        "type_equipement": sensor["type_equipement"],
        "zone":            sensor["zone"],
        "power_w":         round(power_w, 4),
        "temperature":     round(float(row["Temperature"]), 2),
        "humidity":        round(float(row["Humidity"]), 2),
        "wind_speed":      round(float(row["WindSpeed"]), 3),
        "is_injected_anomaly": is_anomaly  # flag de debug uniquement
    }

def run():
    df = pd.read_csv(CSV_PATH)
    print(f"[Simulateur] Dataset chargé : {len(df)} lignes")
    print(f"[Simulateur] Envoi vers {BACKEND_URL} toutes les {INTERVAL_S}s\n")

    for idx, row in df.iterrows():
        for sensor in SENSORS:
            payload = build_payload(row, sensor)
            try:
                resp = requests.post(BACKEND_URL, json=payload, timeout=5)
                status = "✅ OK" if resp.status_code == 201 else f"⚠️  {resp.status_code}"
                anomaly_flag = "🚨 ANOMALIE" if payload["is_injected_anomaly"] else ""
                print(f"[{payload['timestamp']}] {sensor['sensor_id']} "
                      f"| {payload['power_w']:.1f} W  {status} {anomaly_flag}")
            except requests.exceptions.ConnectionError:
                print(f"[ERREUR] Backend inaccessible — ligne {idx}")
            except Exception as e:
                print(f"[ERREUR] {e}")

        time.sleep(INTERVAL_S)

    print("\n[Simulateur] Fin du dataset. Redémarrage...")
    run()  # boucle infinie sur le dataset

if __name__ == "__main__":
    run()
```

---

## 📋 `simulator/requirements.txt`

```
pandas==2.2.2
numpy==1.26.4
requests==2.32.3
```

---

## 📐 Format du document envoyé (JSON)

```json
{
  "timestamp":        "2026-05-05T14:23:10.000Z",
  "sensor_id":        "S-001",
  "batiment_id":      "Zone1",
  "type_equipement":  "Climatisation",
  "zone":             "Zone1",
  "power_w":          29350.42,
  "temperature":      6.5,
  "humidity":         74.2,
  "wind_speed":       0.083,
  "is_injected_anomaly": false
}
```

> **Note :** Le champ `is_injected_anomaly` est un flag de debug. Il ne sera **pas** stocké en base. Le backend découvrira lui-même les anomalies via l'IA.

---

## ✅ Validation de l'Étape 1

### Test 1 — Logs serveur
```bash
# Terminal 1 : Démarrer le backend
cd backend && npm run dev

# Terminal 2 : Démarrer le simulateur
cd simulator && python simulator.py
```

**Résultat attendu côté backend (console.log) :**
```
[IoT] Données reçues : { sensor_id: 'S-001', power_w: 29350.42, ... }
[IoT] Données reçues : { sensor_id: 'S-002', power_w: 19100.12, ... }
[IoT] Données reçues : { sensor_id: 'S-003', power_w: 20450.88, ... }
```
→ Les 3 capteurs envoient des données toutes les **10 secondes**.

### Test 2 — Vérification MongoDB

**Via MongoDB Compass ou terminal :**
```javascript
// Dans mongosh
use energywatch
db.sensor_data.find().limit(5).pretty()
```

**Document attendu en base :**
```json
{
  "_id": "ObjectId(...)",
  "timestamp": "2026-05-05T14:23:10.000Z",
  "sensor_id": "S-001",
  "batiment_id": "Zone1",
  "type_equipement": "Climatisation",
  "zone": "Zone1",
  "power_w": 29350.42,
  "temperature": 6.5,
  "humidity": 74.2,
  "wind_speed": 0.083,
  "createdAt": "2026-05-05T14:23:10.000Z"
}
```

### ✔️ Critères de validation

| Critère                               | Vérifié par                          |
|---------------------------------------|--------------------------------------|
| Données arrivent toutes les 10s       | Logs backend (timestamps)            |
| 3 capteurs envoient simultanément     | 3 lignes de logs par cycle           |
| Documents créés dans `sensor_data`    | MongoDB Compass / mongosh            |
| Valeurs avec bruit (non identiques)   | Comparer lignes du CSV vs reçues     |
| Anomalies visibles (~2%)              | Chercher valeurs > 200 000 W en base |

---

## 🐛 Dépannage

| Erreur                         | Solution                                          |
|--------------------------------|---------------------------------------------------|
| `ConnectionError`              | Le backend n'est pas démarré                      |
| `KeyError: 'PowerConsumption_Zone1'` | Vérifier le nom des colonnes du CSV         |
| `JSONDecodeError`              | Le payload JSON est malformé                      |
| Données trop rapides           | Augmenter `INTERVAL_S`                            |

---

## 🔜 Prochaine étape

➡️ [STEP2 — Backend Node.js](./STEP2_Backend.md)
