# ⚡ EnergyWatch SaaS — Plateforme IoT + IA d'Optimisation des Coûts Énergétiques

> **PFE Licence — Bassem MECHERGUI | Treetronix Technology**

---

## 🎯 Problématique

Les entreprises font face à :
- Des **coûts énergétiques élevés** et non maîtrisés
- Un **manque de visibilité** sur la consommation réelle par zone / équipement
- L'**absence d'outils d'aide à la décision** financière

## 💡 Solution

Une plateforme SaaS qui :
1. **Collecte** les données énergétiques via des capteurs IoT (simulés)
2. **Analyse** les consommations avec des modèles IA (prédiction + anomalies)
3. **Calcule** les coûts en Dinars Tunisiens (DT) selon les tarifs STEG
4. **Affiche** des tableaux de bord temps réel pour la direction financière

---

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUX DE DONNÉES                          │
│                                                                 │
│  [CSV Dataset]                                                  │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐   POST /api/iot/data    ┌──────────────────┐  │
│  │  Simulateur │ ──── (toutes 10s) ────► │  API Node.js     │  │
│  │   Python    │                         │  (Express)       │  │
│  └─────────────┘                         └────────┬─────────┘  │
│                                                   │            │
│                              ┌────────────────────┼──────────┐ │
│                              │                    │          │ │
│                              ▼                    ▼          │ │
│                        ┌──────────┐      ┌──────────────┐   │ │
│                         │ MongoDB  │      │  API FastAPI  │   │ │
│                         │   DB     │      │  (Python/IA) │   │ │
│                         └──────────┘      └──────────────┘   │ │
│                              │                    │           │ │
│                              └────────┬───────────┘           │ │
│                                       │                       │ │
│                                       ▼                       │ │
│                              ┌──────────────────┐             │ │
│                              │  Socket.io Push  │             │ │
│                              └────────┬─────────┘             │ │
│                                       │                       │ │
│                                       ▼                       │ │
│                              ┌──────────────────┐             │ │
│                              │   React.js       │             │ │
│                              │   Dashboard      │             │ │
│                              └──────────────────┘             │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Structure du Projet

```
isra/
├── README.md                    ← Ce fichier
├── TODO.md                      ← Suivi des tâches prioritaires
├── powerconsumption (12).csv    ← Dataset Kaggle (base du simulateur)
│
├── docs/
│   ├── STEP1_IoT_Simulator.md
│   ├── STEP2_Backend.md
│   ├── STEP3_AI_Brain.md
│   ├── STEP4_Financial.md
│   └── STEP5_Frontend.md
│
├── simulator/                   ← ÉTAPE 1 : Simulateur IoT Python
│   ├── simulator.py
│   └── requirements.txt
│
├── backend/                     ← ÉTAPE 2 : API Node.js + Express
│   ├── src/
│   │   ├── routes/
│   │   │   ├── iot.routes.js
│   │   │   ├── energy.routes.js
│   │   │   └── simulate.routes.js
│   │   ├── controllers/
│   │   │   ├── iot.controller.js
│   │   │   ├── energy.controller.js
│   │   │   └── financial.controller.js
│   │   ├── services/
│   │   │   ├── financial.service.js
│   │   │   └── ai.service.js
│   │   ├── models/
│   │   │   ├── SensorData.js
│   │   │   └── Tariff.js
│   │   └── app.js
│   ├── .env
│   └── package.json
│
├── ai_service/                  ← ÉTAPE 3 : API FastAPI + ML Python
│   ├── main.py
│   ├── train_model.py
│   ├── models/
│   │   ├── anomaly_model.pkl
│   │   └── prediction_model.pkl
│   └── requirements.txt
│
└── frontend/                    ← ÉTAPE 5 : React.js Dashboard
    ├── src/
    │   ├── components/
    │   │   ├── KpiCard.jsx
    │   │   ├── EnergyLineChart.jsx
    │   │   ├── CostBarChart.jsx
    │   │   └── AnomalyAlert.jsx
    │   ├── pages/
    │   │   └── Dashboard.jsx
    │   ├── hooks/
    │   │   └── useSocket.js
    │   └── App.jsx
    └── package.json
```

---

## 🔗 Ports & Services

| Service        | Technologie     | Port  |
|----------------|-----------------|-------|
| Backend API    | Node.js/Express | 5000  |
| IA API         | Python/FastAPI  | 8000  |
| Frontend       | React.js        | 3000  |
| MongoDB        | Base de données | 27017 |

---

## 📊 Dataset

**Fichier :** `powerconsumption (12).csv`

| Colonne                  | Description                         |
|--------------------------|-------------------------------------|
| `Datetime`               | Horodatage (10 min intervals, 2017) |
| `Temperature`            | Température extérieure (°C)         |
| `Humidity`               | Humidité (%)                        |
| `WindSpeed`              | Vitesse du vent                     |
| `PowerConsumption_Zone1` | Puissance Zone 1 (Watts)            |
| `PowerConsumption_Zone2` | Puissance Zone 2 (Watts)            |
| `PowerConsumption_Zone3` | Puissance Zone 3 (Watts)            |
| `type_equipement`        | Climatisation / Serveur / Éclairage |

---

## ⚙️ Prérequis

- Node.js >= 18
- Python >= 3.10
- MongoDB (local ou Atlas)
- npm / pip

---

## 🚀 Démarrage Rapide

```bash
# 1. Backend
cd backend && npm install && npm run dev

# 2. AI Service
cd ai_service && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# 3. Simulateur
cd simulator && pip install -r requirements.txt && python simulator.py

# 4. Frontend
cd frontend && npm install && npm start
```

---

## 📋 Étapes du PFE

| Étape | Description                    | Statut |
|-------|--------------------------------|--------|
| 1     | Simulateur IoT                 | ⏳ À faire |
| 2     | Backend Node.js                | ⏳ À faire |
| 3     | Cerveau IA (FastAPI + ML)      | ⏳ À faire |
| 4     | Calcul Financier (DT/kWh)      | ⏳ À faire |
| 5     | Dashboard React.js             | ⏳ À faire |

---

*Développé dans le cadre du PFE Licence — 2026*
