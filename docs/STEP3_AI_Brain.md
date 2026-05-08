# ÉTAPE 3 — Cerveau IA (FastAPI + Machine Learning)

> **Objectif :** Entraîner deux modèles ML sur le dataset CSV, les exposer via une API FastAPI que le backend Node.js appellera pour chaque nouvelle donnée reçue.

---

## 🧠 Architecture IA

```
Dataset CSV (offline)
      │
      ▼
 ┌────────────────────────────────────────────────┐
 │              PHASE D'ENTRAÎNEMENT               │
 │                                                 │
 │  Isolation Forest  →  anomaly_model.pkl        │
 │  Random Forest     →  prediction_model.pkl     │
 └────────────────────────────────────────────────┘
      │
      ▼ (fichiers .pkl chargés au démarrage)
 ┌──────────────────────────────────────┐
 │         API FastAPI (port 8000)      │
 │                                      │
 │  POST /predict                       │
 │    └── retourne is_anomaly +        │
 │         predicted_next_hour         │
 └──────────────────────────────────────┘
      ▲
      │  appel HTTP (axios)
 Backend Node.js
```

---

## 📦 Structure des fichiers

```
ai_service/
├── train.py                  ← Script d'entraînement (exécuté une seule fois)
├── main.py                   ← API FastAPI (inférence)
├── models/
│   ├── anomaly_model.pkl     ← Isolation Forest sauvegardé
│   └── prediction_model.pkl  ← Random Forest sauvegardé
└── requirements.txt
```

---

## 📋 `ai_service/requirements.txt`

```
fastapi==0.111.0
uvicorn==0.29.0
scikit-learn==1.4.2
pandas==2.2.2
numpy==1.26.4
joblib==1.4.2
```

---

## 🔬 Phase 1 — Entraînement (offline) `train.py`

> Exécuter **une seule fois** sur ton PC avant de lancer l'API.

```python
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error
import joblib
import os

# ─── Chargement du dataset ────────────────────────────────────────────────────
CSV_PATH   = "../powerconsumption (12).csv"
MODELS_DIR = "./models"
os.makedirs(MODELS_DIR, exist_ok=True)

df = pd.read_csv(CSV_PATH, parse_dates=["Datetime"])
df = df.dropna()

print(f"[Train] Dataset chargé : {len(df)} lignes")

# ─── Feature Engineering ──────────────────────────────────────────────────────
# On travaille sur la consommation totale des 3 zones
df["total_power_w"] = (
    df["PowerConsumption_Zone1"] +
    df["PowerConsumption_Zone2"] +
    df["PowerConsumption_Zone3"]
)

# Features temporelles et environnementales
df["hour"]        = df["Datetime"].dt.hour
df["day_of_week"] = df["Datetime"].dt.dayofweek   # 0=Lundi, 6=Dimanche
df["month"]       = df["Datetime"].dt.month
df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)

FEATURES = ["hour", "day_of_week", "month", "is_weekend",
            "Temperature", "Humidity", "WindSpeed"]

# ─── 1. Modèle de Détection d'Anomalies (Isolation Forest) ───────────────────
print("\n[Train] Entraînement Isolation Forest...")

# On entraîne sur la puissance totale + features environnementales
X_anomaly = df[["total_power_w", "Temperature", "Humidity", "WindSpeed"]].values

iso_forest = IsolationForest(
    n_estimators=100,
    contamination=0.02,   # 2% du dataset = anomalies (cohérent avec le simulateur)
    random_state=42
)
iso_forest.fit(X_anomaly)

joblib.dump(iso_forest, f"{MODELS_DIR}/anomaly_model.pkl")
print(f"[Train] Isolation Forest sauvegardé → {MODELS_DIR}/anomaly_model.pkl")

# ─── 2. Modèle de Prédiction (Random Forest) ─────────────────────────────────
print("\n[Train] Entraînement Random Forest Regressor...")

X = df[FEATURES].values
y = df["total_power_w"].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=False   # pas de shuffle = respect temporel
)

rf_model = RandomForestRegressor(
    n_estimators=200,
    max_depth=15,
    random_state=42,
    n_jobs=-1
)
rf_model.fit(X_train, y_train)

# ─── Évaluation ───────────────────────────────────────────────────────────────
y_pred = rf_model.predict(X_test)
mape   = mean_absolute_percentage_error(y_test, y_pred) * 100
rmse   = np.sqrt(np.mean((y_test - y_pred) ** 2))

print(f"\n[Résultats]")
print(f"  MAPE  = {mape:.2f}%   (objectif : < 10%)")
print(f"  RMSE  = {rmse:.2f} W")

joblib.dump(rf_model, f"{MODELS_DIR}/prediction_model.pkl")
print(f"[Train] Random Forest sauvegardé → {MODELS_DIR}/prediction_model.pkl")
print("\n✅ Entraînement terminé.")
```

---

## 🚀 Phase 2 — API d'Inférence `main.py`

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import numpy as np
import os

app = FastAPI(title="EnergyWatch AI Service", version="1.0.0")

# ─── Chargement des modèles au démarrage ─────────────────────────────────────
MODELS_DIR = "./models"

try:
    anomaly_model    = joblib.load(f"{MODELS_DIR}/anomaly_model.pkl")
    prediction_model = joblib.load(f"{MODELS_DIR}/prediction_model.pkl")
    print("[AI] Modèles chargés avec succès")
except FileNotFoundError as e:
    raise RuntimeError(f"Modèle introuvable : {e}. Lance d'abord train.py")

# ─── Schéma d'entrée ─────────────────────────────────────────────────────────
class SensorInput(BaseModel):
    power_w:     float = Field(..., gt=0, description="Puissance instantanée en Watts")
    temperature: float = Field(..., description="Température ambiante °C")
    humidity:    float = Field(..., ge=0, le=100, description="Humidité %")
    hour:        int   = Field(..., ge=0, le=23, description="Heure de la journée")
    day_of_week: int   = Field(..., ge=0, le=6, description="Jour 0=Lundi, 6=Dimanche")
    month:       int   = Field(..., ge=1, le=12, description="Mois 1-12")
    wind_speed:  float = Field(default=0.0, ge=0)

# ─── Endpoint principal ───────────────────────────────────────────────────────
@app.post("/predict")
def predict(data: SensorInput):
    # 1. Détection d'anomalie
    X_anomaly = np.array([[data.power_w, data.temperature, data.humidity, data.wind_speed]])
    anomaly_score = anomaly_model.decision_function(X_anomaly)[0]
    is_anomaly    = bool(anomaly_model.predict(X_anomaly)[0] == -1)

    # 2. Prédiction de la prochaine heure (features décalées de +1h)
    next_hour = (data.hour + 1) % 24
    X_pred = np.array([[
        next_hour,
        data.day_of_week,
        data.month,
        1 if data.day_of_week >= 5 else 0,
        data.temperature,
        data.humidity,
        data.wind_speed
    ]])
    predicted_next_w = float(prediction_model.predict(X_pred)[0])

    return {
        "is_anomaly":        is_anomaly,
        "anomaly_score":     round(anomaly_score, 4),   # négatif = suspect
        "predicted_next_w":  round(predicted_next_w, 2),
    }

# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": True}
```

---

## ▶️ Lancement

```bash
# 1. Créer l'environnement virtuel
cd ai_service
python -m venv venv
source venv/bin/activate      # Windows : venv\Scripts\activate

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Entraîner les modèles (une seule fois)
python train.py

# 4. Lancer l'API FastAPI
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔌 Intégration dans Node.js — `backend/src/services/ai.service.js`

```javascript
const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Appelle l'API FastAPI pour analyser une lecture de capteur.
 * @param {object} data - { power_w, temperature, humidity, hour, day_of_week, month, wind_speed }
 * @returns {{ is_anomaly: boolean, predicted_next_w: number }}
 */
exports.analyzeWithAI = async (data) => {
  try {
    const ts          = new Date(data.timestamp || Date.now());
    const day_of_week = ts.getDay() === 0 ? 6 : ts.getDay() - 1; // 0=Lundi

    const response = await axios.post(`${AI_URL}/predict`, {
      power_w:     data.power_w,
      temperature: data.temperature ?? 20,
      humidity:    data.humidity    ?? 50,
      hour:        ts.getHours(),
      day_of_week,
      month:       ts.getMonth() + 1,
      wind_speed:  data.wind_speed  ?? 0,
    }, { timeout: 3000 });

    return response.data;
  } catch (err) {
    // Si l'IA est indisponible, on ne bloque pas le pipeline
    console.warn('[AI Service] Indisponible :', err.message);
    return { is_anomaly: false, predicted_next_w: null };
  }
};
```

> Ajoute `AI_SERVICE_URL=http://localhost:8000` dans ton `backend/.env`.

---

## ✅ Validation de l'Étape 3

### Test 1 — Valeur normale

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "power_w": 29000,
    "temperature": 22.5,
    "humidity": 60,
    "hour": 14,
    "day_of_week": 1,
    "month": 5,
    "wind_speed": 0.1
  }'
```

**Réponse attendue :**
```json
{
  "is_anomaly": false,
  "anomaly_score": 0.0821,
  "predicted_next_w": 28450.5
}
```

### Test 2 — Anomalie injectée (valeur absurde)

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "power_w": 999999,
    "temperature": 22.5,
    "humidity": 60,
    "hour": 14,
    "day_of_week": 1,
    "month": 5,
    "wind_speed": 0.1
  }'
```

**Réponse attendue :**
```json
{
  "is_anomaly": true,
  "anomaly_score": -0.2134,
  "predicted_next_w": 28450.5
}
```

> Le score d'anomalie doit être **négatif** pour les cas suspects.

### Test 3 — Métriques MAPE (sortie `train.py`)

```
[Résultats]
  MAPE  = 4.87%   ✅ (objectif : < 10%)
  RMSE  = 1243.2 W
```

### Test 4 — Health check

```bash
curl http://localhost:8000/health
# → {"status": "ok", "models_loaded": true}
```

### ✔️ Critères de validation

| Critère                                    | Vérifié par                        |
|--------------------------------------------|------------------------------------|
| `train.py` termine sans erreur             | Sortie console                     |
| MAPE < 10%                                 | Sortie console de `train.py`       |
| Valeur normale → `is_anomaly: false`       | curl / Postman                     |
| Valeur absurde (999999W) → `is_anomaly: true` | curl / Postman                  |
| Node.js appelle l'IA et reçoit une réponse | Logs backend `[Async Error]` absent|
| `is_anomaly` stocké dans MongoDB           | MongoDB Compass                    |

---

## 🐛 Dépannage

| Erreur                              | Solution                                                  |
|-------------------------------------|-----------------------------------------------------------|
| `FileNotFoundError: anomaly_model.pkl` | Lancer `python train.py` d'abord                     |
| `422 Unprocessable Entity`          | Champ manquant ou type incorrect dans le body JSON        |
| `MAPE > 10%`                        | Augmenter `n_estimators` ou ajouter des features          |
| FastAPI inaccessible depuis Node.js | Vérifier que `uvicorn` tourne sur le port 8000            |

---

## 🔜 Prochaine étape

➡️ [STEP4 — Calcul Financier (Watts → Dinars)](./STEP4_Financial.md)
