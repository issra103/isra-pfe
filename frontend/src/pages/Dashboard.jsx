import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { getKPIs, getLatest, getAnomalies, getSimulatorStatus, startSimulator, stopSimulator } from '../api/energyApi';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const ZONE_COLORS = { Zone1: '#10b981', Zone2: '#6366f1', Zone3: '#f59e0b' };
const PERIODS = [
  { id: 'all', label: 'Tout' },
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
];

function fmt(n, d = 1) { return n != null ? Number(n).toFixed(d) : '—'; }
function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

function KPI({ label, value, unit, color, icon }) {
  return (
    <div className="glass-panel kpi-card animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span className="kpi-label">{label}</span>
        <span style={{ fontSize: 20, opacity: 0.7 }}>{icon}</span>
      </div>
      <div className="kpi-value" style={{ color: color || '#6366f1' }}>
        {value}<span className="kpi-unit">{unit}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [readings, setReadings] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [simStatus, setSimStatus] = useState('unknown');
  const [simLoading, setSimLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [kpiPeriod, setKpiPeriod] = useState('all');
  const liveRef = useRef([]);

  const load = useCallback(async () => {
    try {
      const [k, r, a] = await Promise.all([getKPIs(kpiPeriod), getLatest(), getAnomalies()]);
      setKpis(k);
      liveRef.current = r.slice(0, 60);
      setReadings([...liveRef.current]);
      setAnomalies(a.slice(0, 5));
    } catch (_) {}
  }, [kpiPeriod]);

  useEffect(() => {
    load();
    getSimulatorStatus().then(s => setSimStatus(s.running ? 'running' : 'stopped')).catch(() => {});
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const onNewReading = useCallback((data) => {
    const idx = liveRef.current.findIndex(r => r._id === data._id);
    if (idx !== -1) {
      liveRef.current[idx] = data;
    } else {
      liveRef.current = [data, ...liveRef.current].slice(0, 60);
    }
    setReadings([...liveRef.current]);
  }, []);

  const onAnomalyDetected = useCallback((data) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, data }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
    setAnomalies(prev => [data, ...prev].slice(0, 5));
  }, []);

  const onSimStatus = useCallback((s) => setSimStatus(s.running ? 'running' : 'stopped'), []);

  useSocket(onNewReading, onAnomalyDetected, onSimStatus);

  const toggleSim = async () => {
    setSimLoading(true);
    try {
      if (simStatus === 'running') { await stopSimulator(); setSimStatus('stopped'); }
      else { await startSimulator(); setSimStatus('running'); }
    } catch (_) {}
    setSimLoading(false);
  };

  const chartData = [...readings].reverse().slice(-30).map(r => ({
    t: fmtTime(r.datetime),
    total: +((r.totalConsumption || 0) / 1000).toFixed(2),
    Zone1: +((r.consumption_zone1 || 0) / 1000).toFixed(2),
    Zone2: +((r.consumption_zone2 || 0) / 1000).toFixed(2),
    Zone3: +((r.consumption_zone3 || 0) / 1000).toFixed(2),
  }));

  const latestReading = readings[0];
  const peakData = [
    { name: 'Heure Pleine', cost: kpis?.peakCost || 0 },
    { name: 'Heure Creuse', cost: kpis?.offPeakCost || 0 },
  ];

  const zoneKpis = kpis?.equipements || [];
  const isRunning = simStatus === 'running';

  return (
    <div className="page-wrapper">
      {/* Anomaly toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(({ id, data }) => (
          <div key={id} className="anomaly-toast glass-panel" style={{ padding: '0.875rem 1.25rem', maxWidth: 320, borderColor: 'rgba(239,68,68,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="pulse-dot" style={{ background: '#ef4444' }} />
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#f87171' }}>Anomalie détectée</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {data.type_equipement} &middot;{' '}
              <strong style={{ color: '#fca5a5' }}>{fmt(data.totalConsumption, 0)} W</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title gradient-text">Tableau de bord</h1>
          <p className="page-subtitle">
            Vue d&apos;ensemble en temps réel &mdash;{' '}
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="pulse-dot" style={{ background: isRunning ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isRunning ? 'Simulateur actif' : simStatus === 'stopped' ? 'Simulateur arrêté' : 'Statut inconnu'}
            </span>
          </div>
          <button
            className={isRunning ? 'btn btn-red' : 'btn btn-emerald'}
            onClick={toggleSim}
            disabled={simLoading}
          >
            {simLoading && <span className="loader-spin" />}
            {simLoading ? '...' : isRunning ? '⏹ Arrêter' : '▶ Démarrer'}
          </button>
        </div>
      </div>

      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setKpiPeriod(p.id)}
            className={kpiPeriod === p.id ? 'btn btn-emerald' : 'btn'}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.75rem' }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Global KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPI label="Énergie totale"       value={fmt(kpis?.total_kwh, 2)}    unit=" kWh" color="#10b981" icon="⚡" />
        <KPI label="Coût total"           value={fmt(kpis?.total_cost_dt, 3)} unit=" DT"  color="#f59e0b" icon="💰" />
        <KPI label="Anomalies détectées"  value={kpis?.anomaly_count ?? '—'}  unit=""     color="#ef4444" icon="🔴" />
        <KPI label="Consommation moyenne" value={fmt(kpis?.avg_consumption, 0)} unit=" W" color="#6366f1" icon="📊" />
        <KPI label="Prédiction +1h"       value={fmt(latestReading?.predicted_next_hour, 0)} unit=" W" color="#8b5cf6" icon="🔮" />
      </div>

      {/* Per-zone strip */}
      {zoneKpis.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {zoneKpis.map(z => {
            const colors = { Climatisation: '#10b981', Serveur: '#6366f1', 'Éclairage': '#f59e0b' };
            const c = colors[z.type_equipement] || '#6366f1';
            return (
              <div key={z.type_equipement} className="glass-panel" style={{ padding: '1.25rem', borderColor: c + '30' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{z.type_equipement}</span>
                  <span className="badge" style={{ background: c + '20', color: c, border: '1px solid ' + c + '40' }}>
                    {fmt(z.avg_consumption, 0)} W moy.
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 2 }}>Énergie</div>
                    <div style={{ fontWeight: 700, color: c }}>{fmt(z.total_kwh, 3)} kWh</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 2 }}>Coût</div>
                    <div style={{ fontWeight: 700, color: '#fbbf24' }}>{fmt(z.total_cost_dt, 4)} DT</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 2 }}>Anomalies</div>
                    <div style={{ fontWeight: 700, color: '#f87171' }}>{z.anomaly_count}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live chart — AreaChart with gradient */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <div className="pulse-dot" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Flux temps réel &mdash; Puissance par zone (kW)</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
            {Object.entries(ZONE_COLORS).map(([z, c]) => (
              <span key={z} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 12, height: 3, background: c, borderRadius: 2, display: 'inline-block' }} />
                {z}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <defs>
              {Object.entries(ZONE_COLORS).map(([z, c]) => (
                <linearGradient key={z} id={`grad_${z}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} />
            <Tooltip
              contentStyle={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, fontSize: 12, color: 'rgba(15,23,42,0.9)' }}
              labelStyle={{ color: 'rgba(71,85,105,0.9)', marginBottom: 4 }}
            />
            {Object.entries(ZONE_COLORS).map(([z, c]) => (
              <Area key={z} type="monotone" dataKey={z} stroke={c} strokeWidth={2} fill={`url(#grad_${z})`} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Peak vs Off-Peak cost BarChart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', display: 'block' }}>Coût : Heure Pleine vs Creuse</span>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={peakData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(100,116,139,0.8)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} />
              <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cost" radius={[6, 6, 0, 0]} fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', display: 'block' }}>Répartition tarifaire</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Heure Pleine</span>
              <span style={{ fontWeight: 800, color: '#f59e0b' }}>{fmt(kpis?.peakCost, 4)} DT</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Heure Creuse</span>
              <span style={{ fontWeight: 800, color: '#10b981' }}>{fmt(kpis?.offPeakCost, 4)} DT</span>
            </div>
            <div style={{ height: 6, background: 'rgba(15,23,42,0.08)', borderRadius: 3, marginTop: '0.5rem', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: ((kpis?.peakCost || 0) / Math.max((kpis?.peakCost || 0) + (kpis?.offPeakCost || 0), 1) * 100) + '%',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                borderRadius: 3,
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent anomalies */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          🔴 Anomalies récentes
          <span className="badge badge-red" style={{ marginLeft: 'auto' }}>{anomalies.length}</span>
        </div>
        {anomalies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Aucune anomalie détectée récemment ✓
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Heure</th><th>Type</th><th>Consommation totale</th><th>Coût</th></tr>
            </thead>
            <tbody>
              {anomalies.map((a, i) => {
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)' }}>{fmtTime(a.datetime)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{a.type_equipement}</td>
                    <td style={{ color: '#f87171', fontWeight: 700 }}>{fmt(a.totalConsumption, 0)} W</td>
                    <td style={{ color: '#fbbf24' }}>{fmt(a.cost_est, 4)} DT</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
