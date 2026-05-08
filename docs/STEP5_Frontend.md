# ÉTAPE 5 — Frontend React.js Dashboard

> **Objectif :** Construire un dashboard temps réel qui consomme l'API Node.js et Socket.io pour afficher les KPIs financiers, les graphiques de consommation, et alerter en cas d'anomalie IA.

---

## 🧠 Architecture Frontend

```
React App (port 3000)
      │
      ├── HTTP (axios)       →  GET /api/energy/kpis
      │                      →  GET /api/energy/latest
      │                      →  GET /api/energy/anomalies
      │
      └── WebSocket (Socket.io)  ←── Backend Node.js (port 4000)
              │
              ├── event: "new_reading"        → Met à jour le graphique live
              └── event: "anomaly_detected"   → Déclenche l'alerte rouge
```

---

## 📦 Structure des fichiers

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── api/
│   │   └── energyApi.js          ← Appels HTTP axios
│   ├── hooks/
│   │   └── useSocket.js          ← Hook Socket.io réutilisable
│   ├── components/
│   │   ├── KpiCard.jsx           ← Carte KPI (coût, kWh, anomalies)
│   │   ├── LiveLineChart.jsx     ← Graphique consommation temps réel
│   │   ├── TariffBarChart.jsx    ← Coût HP vs HC (BarChart)
│   │   ├── AnomalyAlert.jsx      ← Bandeau d'alerte rouge clignotant
│   │   └── AnomalyTable.jsx      ← Tableau des dernières anomalies
│   ├── pages/
│   │   └── Dashboard.jsx         ← Page principale
│   ├── App.jsx
│   └── main.jsx
├── .env
├── package.json
└── vite.config.js
```

---

## 📋 Setup du projet

```bash
# Créer le projet avec Vite
npm create vite@latest frontend -- --template react
cd frontend

# Installer les dépendances
npm install axios socket.io-client recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## ⚙️ `frontend/.env`

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

---

## ⚙️ `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
```

---

## ⚙️ `frontend/tailwind.config.js`

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Ajoute dans `src/index.css` :
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 🔌 Hook Socket.io — `src/hooks/useSocket.js`

```javascript
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export function useSocket(onNewReading, onAnomalyDetected) {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      console.log('[Socket] Connecté :', socketRef.current.id);
    });

    socketRef.current.on('new_reading', (data) => {
      if (onNewReading) onNewReading(data);
    });

    socketRef.current.on('anomaly_detected', (data) => {
      if (onAnomalyDetected) onAnomalyDetected(data);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);
}
```

---

## 📡 API client — `src/api/energyApi.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 5000,
});

export const getKPIs       = () => api.get('/api/energy/kpis').then(r => r.data);
export const getLatest     = () => api.get('/api/energy/latest').then(r => r.data);
export const getAnomalies  = () => api.get('/api/energy/anomalies').then(r => r.data);
```

---

## 🃏 Composant KPI — `src/components/KpiCard.jsx`

```jsx
export default function KpiCard({ title, value, unit, color = 'blue', icon }) {
  const colors = {
    blue:   'bg-blue-50  border-blue-200  text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    red:    'bg-red-50   border-red-200   text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className={`rounded-2xl border-2 p-5 shadow-sm ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-70">{title}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold">
        {value ?? '—'}
        <span className="text-base font-normal ml-1 opacity-60">{unit}</span>
      </p>
    </div>
  );
}
```

---

## 🚨 Composant Alerte — `src/components/AnomalyAlert.jsx`

```jsx
import { useEffect, useState } from 'react';

export default function AnomalyAlert({ anomaly, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (anomaly) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 15000); // auto-dismiss 15s
      return () => clearTimeout(timer);
    }
  }, [anomaly]);

  if (!visible || !anomaly) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl
                    animate-pulse bg-red-600 text-white rounded-xl shadow-2xl
                    border-2 border-red-400 px-6 py-4 flex items-start gap-4">
      <span className="text-3xl">🚨</span>
      <div className="flex-1">
        <p className="font-bold text-lg">ANOMALIE DÉTECTÉE</p>
        <p className="text-sm opacity-90">
          Capteur <strong>{anomaly.sensor_id}</strong> —{' '}
          Zone <strong>{anomaly.batiment_id}</strong>
        </p>
        <p className="text-sm opacity-90">
          Puissance : <strong>{anomaly.power_w?.toLocaleString()} W</strong>
        </p>
      </div>
      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        className="text-white hover:text-red-200 text-xl font-bold"
      >
        ✕
      </button>
    </div>
  );
}
```

---

## 📈 Graphique Live — `src/components/LiveLineChart.jsx`

```jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function LiveLineChart({ data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Consommation en temps réel (W)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => new Date(v).toLocaleTimeString()}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString()}
            formatter={(val) => [`${val.toLocaleString()} W`]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="power_w"
            name="Puissance (W)"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="predicted_next_w"
            name="Prédiction IA (W)"
            stroke="#10b981"
            dot={false}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 📊 BarChart HP/HC — `src/components/TariffBarChart.jsx`

```jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function TariffBarChart({ data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Coût par tranche horaire (DT)
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" DT" />
          <Tooltip formatter={(val) => [`${val.toFixed(4)} DT`]} />
          <Legend />
          <Bar dataKey="heure_pleine" name="Heure Pleine" fill="#f59e0b" radius={[4,4,0,0]} />
          <Bar dataKey="heure_creuse" name="Heure Creuse" fill="#6366f1" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 🖥️ Page principale — `src/pages/Dashboard.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react';
import KpiCard        from '../components/KpiCard';
import LiveLineChart  from '../components/LiveLineChart';
import TariffBarChart from '../components/TariffBarChart';
import AnomalyAlert   from '../components/AnomalyAlert';
import { useSocket }  from '../hooks/useSocket';
import { getKPIs, getLatest } from '../api/energyApi';

const MAX_POINTS = 60; // garder les 60 dernières lectures sur le graphique

export default function Dashboard() {
  const [kpis,          setKpis]          = useState(null);
  const [chartData,     setChartData]     = useState([]);
  const [activeAnomaly, setActiveAnomaly] = useState(null);

  // ─── Chargement initial ───────────────────────────────────────────────────
  useEffect(() => {
    getKPIs().then(setKpis).catch(console.error);
    getLatest().then((rows) => setChartData(rows.slice(0, MAX_POINTS).reverse()))
               .catch(console.error);
  }, []);

  // ─── Socket.io — nouvelles données ────────────────────────────────────────
  const handleNewReading = useCallback((reading) => {
    setChartData(prev => {
      const updated = [...prev, reading];
      return updated.length > MAX_POINTS ? updated.slice(-MAX_POINTS) : updated;
    });
    setKpis(prev => prev ? {
      ...prev,
      total_kwh:     (prev.total_kwh     || 0) + (reading.energy_kwh || 0),
      total_cost_dt: (prev.total_cost_dt || 0) + (reading.cost_dt    || 0),
      readings:      (prev.readings      || 0) + 1,
    } : prev);
  }, []);

  const handleAnomaly = useCallback((anomaly) => {
    setActiveAnomaly(anomaly);
    setKpis(prev => prev ? {
      ...prev,
      anomaly_count: (prev.anomaly_count || 0) + 1,
    } : prev);
  }, []);

  useSocket(handleNewReading, handleAnomaly);

  // ─── Données BarChart (agrégation par zone / tariff_type) ─────────────────
  const barData = ['Zone1', 'Zone2', 'Zone3'].map(zone => {
    const zoneReadings = chartData.filter(d => d.zone === zone);
    return {
      zone,
      heure_pleine: zoneReadings
        .filter(d => d.tariff_type === 'heure_pleine')
        .reduce((s, d) => s + (d.cost_dt || 0), 0),
      heure_creuse: zoneReadings
        .filter(d => d.tariff_type === 'heure_creuse')
        .reduce((s, d) => s + (d.cost_dt || 0), 0),
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Alerte anomalie */}
      <AnomalyAlert
        anomaly={activeAnomaly}
        onDismiss={() => setActiveAnomaly(null)}
      />

      {/* En-tête */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">EnergyWatch Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Surveillance énergétique en temps réel — {new Date().toLocaleDateString('fr-TN')}
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Coût total du jour"
          value={kpis?.total_cost_dt?.toFixed(3)}
          unit="DT"
          color="blue"
          icon="💰"
        />
        <KpiCard
          title="Énergie consommée"
          value={kpis?.total_kwh?.toFixed(3)}
          unit="kWh"
          color="green"
          icon="⚡"
        />
        <KpiCard
          title="Anomalies détectées"
          value={kpis?.anomaly_count}
          unit=""
          color={kpis?.anomaly_count > 0 ? 'red' : 'green'}
          icon="🚨"
        />
        <KpiCard
          title="Puissance moyenne"
          value={kpis?.avg_power_w?.toFixed(0)}
          unit="W"
          color="yellow"
          icon="📡"
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveLineChart  data={chartData} />
        <TariffBarChart data={barData}   />
      </div>
    </div>
  );
}
```

---

## 🚀 `src/App.jsx`

```jsx
import Dashboard from './pages/Dashboard';
import './index.css';

export default function App() {
  return <Dashboard />;
}
```

---

## ▶️ Lancement

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## ✅ Validation de l'Étape 5

### Test 1 — Réactivité temps réel

1. Lance le backend + simulateur
2. Ouvre `http://localhost:3000`
3. Le graphique **doit se mettre à jour toutes les 10 secondes** sans rafraîchissement

### Test 2 — Alerte anomalie

Injecte une donnée anormale via Postman :
```json
POST http://localhost:4000/api/iot/data
{
  "timestamp": "2026-05-05T14:00:00.000Z",
  "sensor_id": "S-001",
  "batiment_id": "Zone1",
  "type_equipement": "Climatisation",
  "zone": "Zone1",
  "power_w": 999999,
  "temperature": 22.5,
  "humidity": 60,
  "wind_speed": 0.1
}
```
→ Le bandeau rouge clignotant **doit apparaître** dans les 3 secondes.

### Test 3 — Cohérence des données

| Vérification                          | Comment                                      |
|---------------------------------------|----------------------------------------------|
| KPI "Coût total" = somme en MongoDB   | `db.sensor_data.aggregate([{$group:{_id:null,total:{$sum:"$cost_dt"}}}])` |
| KPI "kWh" = somme en MongoDB          | Même agrégation sur `energy_kwh`             |
| Graphique zone correspond à zone      | Filtrer par `zone` et comparer les valeurs   |

### Test 4 — Responsive

Ouvre les DevTools → Toggle Device Toolbar → tester sur iPhone 14 (390px).  
Les 4 KPI Cards doivent passer en **2 colonnes** (grid-cols-2).

### ✔️ Critères de validation

| Critère                                  | Vérifié par                           |
|------------------------------------------|---------------------------------------|
| Dashboard charge sans erreur console     | DevTools → Console (aucune erreur)    |
| KPIs s'affichent dès le chargement       | Visuel + réseau (onglet Network)      |
| Graphique se met à jour toutes les 10s   | Observation live                      |
| Alerte rouge sur anomalie injectée       | Postman + observation visuel          |
| Responsive mobile OK                     | DevTools Device Toolbar               |
| Données KPI = données MongoDB            | Comparaison agrégation                |

---

## 🐛 Dépannage

| Erreur                              | Solution                                                    |
|-------------------------------------|-------------------------------------------------------------|
| CORS Error sur Socket.io            | Vérifier `FRONTEND_URL=http://localhost:3000` dans `.env` backend |
| Graphique vide au chargement        | Vérifier que `GET /api/energy/latest` retourne des données  |
| KPIs tous à `—`                     | Vérifier `GET /api/energy/kpis` retourne un objet non vide  |
| Alerte ne s'affiche pas             | Vérifier que l'IA FastAPI est démarrée (sinon `is_anomaly` reste false) |
| `socket is not connected`           | Vérifier `VITE_SOCKET_URL` dans `.env` et que le backend tourne |

---

## 🎉 Architecture complète validée

```
[Simulateur Python]
      │  POST /api/iot/data (toutes les 10s)
      ▼
[Backend Node.js :4000]
      │  save → MongoDB
      │  POST /predict → [FastAPI :8000]
      │  calcul DT     → MongoDB
      │  emit()        →
      ▼                  [Socket.io]
[MongoDB]                     │
      │  GET /api/kpis        ▼
      └──────────────► [React Dashboard :3000]
```

| Étape | Service         | Port | Status |
|-------|-----------------|------|--------|
| 1     | Simulateur IoT  | —    | ✅     |
| 2     | Backend Node.js | 4000 | ✅     |
| 3     | FastAPI (IA)    | 8000 | ✅     |
| 4     | Calcul financier| —    | ✅     |
| 5     | React Dashboard | 3000 | ✅     |
