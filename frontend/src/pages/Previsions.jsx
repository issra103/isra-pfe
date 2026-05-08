import { useState, useEffect, useCallback } from 'react';
import { getPredictions } from '../api/energyApi';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RefreshCw, TrendingUp } from 'lucide-react';

const EQUIP_COLORS = { Climatisation: '#10b981', Serveur: '#6366f1', 'Éclairage': '#f59e0b' };
const EQUIP_PRED   = { Climatisation: '#059669', Serveur: '#7c3aed', 'Éclairage': '#d97706' };
const POLL_MS = 15000;

function fmt(n, d = 1) { return n != null ? Number(n).toFixed(d) : '—'; }
function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
}

export default function Previsions() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await getPredictions();
      setPredictions(data);
      setLastUpdate(new Date());
    } catch {
      // keep existing data
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

  const chartData = (() => {
    const byTs = {};
    [...predictions].reverse().forEach(r => {
      const t = fmtTime(r.datetime);
      if (!t) return;
      if (!byTs[t]) byTs[t] = { t };
      const key = r.type_equipement || 'Unknown';
      byTs[t][key + '_real'] = +((r.totalConsumption || 0) / 1000).toFixed(2);
      if (r.predicted_next_hour) byTs[t][key + '_pred'] = +((r.predicted_next_hour) / 1000).toFixed(2);
    });
    return Object.values(byTs);
  })();

  // Compute MAPE per equipment type
  const mapeByEquip = (() => {
    const errors = {};
    predictions.forEach(r => {
      if (!r.predicted_next_hour || r.totalConsumption === 0) return;
      const key = r.type_equipement;
      if (!errors[key]) errors[key] = { sum: 0, count: 0 };
      errors[key].sum   += Math.abs((r.totalConsumption - r.predicted_next_hour) / r.totalConsumption);
      errors[key].count += 1;
    });
    const result = {};
    Object.entries(errors).forEach(([k, e]) => {
      result[k] = e.count > 0 ? (e.sum / e.count * 100) : null;
    });
    return result;
  })();

  const predsWithPred = predictions.filter(r => r.predicted_next_hour != null).length;

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title gradient-text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={22} /> Prévisions IA
          </h1>
          <p className="page-subtitle">Modèle Random Forest — prédiction de la puissance par zone · Mise à jour automatique toutes les 15s</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdate && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="btn btn-ghost" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
            Actualiser
          </button>
        </div>
      </div>
      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      {/* MAPE cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {Object.entries(EQUIP_COLORS).map(([equip, c]) => {
          const mape = mapeByEquip[equip];
          return (
            <div key={equip} className="glass-panel" style={{ padding: '1.25rem', borderColor: c + '30' }}>
              <span className="kpi-label">{equip} — MAPE</span>
              <div className="kpi-value" style={{ color: c, fontSize: '2rem' }}>
                {mape != null ? fmt(mape, 2) + '%' : '—'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Erreur absolue moyenne
              </div>
            </div>
          );
        })}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span className="kpi-label">Lectures avec prévision</span>
          <div className="kpi-value" style={{ color: '#4f46e5' }}>{predsWithPred}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>sur {predictions.length} total</div>
        </div>
      </div>

      {/* AI model info */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Algorithme</div>
            <div style={{ fontWeight: 700, color: '#4f46e5' }}>Random Forest Regressor</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Features</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Heure, minute, jour semaine, zone</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Entraînement</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Dataset CSV STEG (~52 000 lignes)</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Statut modèle</div>
            <span className="badge badge-emerald">Actif</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="loader-spin" style={{ width: 40, height: 40 }} />
        </div>
      ) : predsWithPred === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Aucune prévision disponible. Le service IA doit être démarré et des données collectées.
        </div>
      ) : (
        <>
          {/* Combined chart */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Puissance réelle vs. prévue (kW)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Ligne pleine = réel · Ligne pointillée = prévision IA
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.07)" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} interval={Math.floor(chartData.length / 8)} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} unit=" kW" />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, fontSize: 12, color: 'rgba(15,23,42,0.9)' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                {Object.entries(EQUIP_COLORS).map(([e, c]) => (
                  <Line key={e + '_real'} type="monotone" dataKey={e + '_real'} name={e + ' réel'} stroke={c} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
                {Object.entries(EQUIP_PRED).map(([e, c]) => (
                  <Line key={e + '_pred'} type="monotone" dataKey={e + '_pred'} name={e + ' prévu'} stroke={c} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data table */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Détail des prévisions récentes</div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Heure</th><th>Équipement</th><th>Réel (W)</th><th>Prévu (W)</th><th>Erreur</th></tr>
                </thead>
                <tbody>
                  {predictions.filter(r => r.predicted_next_hour != null).slice(0, 40).map((r, i) => {
                    const c   = EQUIP_COLORS[r.type_equipement] || '#6366f1';
                    const err = r.totalConsumption > 0 ? Math.abs((r.totalConsumption - r.predicted_next_hour) / r.totalConsumption * 100) : null;
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{fmtTime(r.datetime)}</td>
                        <td><span className="badge" style={{ background: c + '20', color: c, border: '1px solid ' + c + '40' }}>{r.type_equipement}</span></td>
                        <td style={{ fontWeight: 700 }}>{fmt(r.totalConsumption, 0)}</td>
                        <td style={{ color: '#4f46e5' }}>{fmt(r.predicted_next_hour, 0)}</td>
                        <td style={{ color: err != null && err > 10 ? '#b91c1c' : '#065f46' }}>
                          {err != null ? fmt(err, 1) + '%' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
