import { useState, useEffect, useCallback } from 'react';
import { getAnomalies } from '../api/energyApi';
import { RefreshCw, ShieldAlert } from 'lucide-react';

const EQUIP_COLORS = { Climatisation: '#10b981', Serveur: '#6366f1', 'Éclairage': '#f59e0b' };
const POLL_MS = 15000;

function fmt(n, d = 1) { return n != null ? Number(n).toFixed(d) : '—'; }
function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await getAnomalies();
      setAnomalies(data);
      setLastUpdate(new Date());
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const equipTypes = ['all', ...Object.keys(EQUIP_COLORS)];

  const visible = filter === 'all'
    ? anomalies
    : anomalies.filter(a => a.type_equipement === filter);

  const statsByEquip = Object.keys(EQUIP_COLORS).map(type => ({
    type,
    count: anomalies.filter(a => a.type_equipement === type).length,
    avgPower: (() => {
      const eAnom = anomalies.filter(a => a.type_equipement === type);
      return eAnom.length ? eAnom.reduce((s, a) => s + (a.totalConsumption || 0), 0) / eAnom.length : 0;
    })(),
  }));

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title gradient-text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={22} /> Anomalies IA
          </h1>
          <p className="page-subtitle">Détection automatique par Isolation Forest — seuil 5% · Mise à jour toutes les 15s</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {lastUpdate && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {equipTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="btn"
                style={filter === t
                  ? { background: t === 'all' ? 'rgba(99,102,241,0.25)' : (EQUIP_COLORS[t] + '25'), color: t === 'all' ? '#4f46e5' : EQUIP_COLORS[t], border: '1px solid ' + (t === 'all' ? 'rgba(99,102,241,0.4)' : EQUIP_COLORS[t] + '50') }
                  : {}}
              >
                {t === 'all' ? 'Toutes' : t}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
          </button>
        </div>
      </div>
      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      {/* Stats per equipment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span className="kpi-label">Total anomalies</span>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{anomalies.length}</div>
        </div>
        {statsByEquip.map(({ type, count, avgPower }) => {
          const c = EQUIP_COLORS[type];
          return (
            <div key={type} className="glass-panel" style={{ padding: '1.25rem', borderColor: c + '30' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{type}</span>
                <span className="badge badge-red">{count}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Moy. {fmt(avgPower, 0)} W</div>
              <div style={{ height: 3, background: 'rgba(15,23,42,0.08)', borderRadius: 2, marginTop: '0.5rem' }}>
                <div style={{ height: '100%', width: (anomalies.length > 0 ? count / anomalies.length * 100 : 0) + '%', background: c, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Full anomaly table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={15} style={{ color: '#dc2626' }} /> Historique des anomalies
          <span className="badge badge-red" style={{ marginLeft: 'auto' }}>{visible.length}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="loader-spin" style={{ width: 36, height: 36 }} />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Aucune anomalie détectée ✓
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Équipement</th>
                  <th>Puissance totale</th>
                  <th>Énergie</th>
                  <th>Coût</th>
                  <th>Source</th>
                  <th>Prévision IA</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a, i) => {
                  const c = EQUIP_COLORS[a.type_equipement] || '#6366f1';
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{fmtDate(a.datetime)}</td>
                      <td>
                        <span className="badge" style={{ background: c + '20', color: c, border: '1px solid ' + c + '40' }}>{a.type_equipement}</span>
                      </td>
                      <td><span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(a.totalConsumption, 1)} W</span></td>
                      <td style={{ color: '#10b981' }}>{fmt(a.energy_kwh, 5)} kWh</td>
                      <td style={{ color: '#b45309' }}>{fmt(a.cost_est, 4)} DT</td>
                      <td>
                        {a.ai_detected_anomaly
                          ? <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>IA</span>
                          : <span className="badge" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>Manuel</span>
                        }
                      </td>
                      <td style={{ color: '#4f46e5' }}>{a.predicted_next_hour ? fmt(a.predicted_next_hour, 0) + ' W' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
