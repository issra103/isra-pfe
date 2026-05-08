import { useState, useEffect } from 'react';
import { getMonthlyReport, getLatest } from '../api/energyApi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';

const EQUIP_COLORS = { Climatisation: '#10b981', Serveur: '#6366f1', 'Éclairage': '#f59e0b' };

function fmt(n, d = 2) { return n != null ? Number(n).toFixed(d) : '—'; }

function addMonths(str, delta) {
  const [y, m] = str.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Rapports() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  useEffect(() => {
    if (!autoDetected) {
      setAutoDetected(true);
      getLatest().then(items => {
        if (items?.[0]?.datetime) {
          const d = new Date(items[0].datetime);
          const detected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (detected !== month) setMonth(detected);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    getMonthlyReport(month)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  // Transform daily data for chart: each day, sum across equipment types
  const dailyTotals = (() => {
    if (!data?.daily) return [];
    const byDay = {};
    data.daily.forEach(d => {
      const day = String(d._id.day).padStart(2, '0');
      const equip = d._id.type_equipement;
      if (!byDay[day]) byDay[day] = { day };
      byDay[day][equip + '_kwh']  = +(d.total_kwh || 0).toFixed(3);
      byDay[day][equip + '_cost'] = +(d.total_cost_dt || 0).toFixed(4);
      byDay[day][equip + '_anom'] = d.anomaly_count || 0;
    });
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  })();

  // Monthly totals per equipment type
  const equipTotals = (() => {
    if (!data?.daily) return {};
    const totals = {};
    data.daily.forEach(d => {
      const e = d._id.type_equipement;
      if (!totals[e]) totals[e] = { kwh: 0, cost: 0, anomalies: 0 };
      totals[e].kwh     += d.total_kwh || 0;
      totals[e].cost    += d.total_cost_dt || 0;
      totals[e].anomalies += d.anomaly_count || 0;
    });
    return totals;
  })();

  const grandTotal = Object.values(equipTotals).reduce((s, z) => ({ kwh: s.kwh + z.kwh, cost: s.cost + z.cost, anomalies: s.anomalies + z.anomalies }), { kwh: 0, cost: 0, anomalies: 0 });

  const exportCSV = () => {
    if (!data?.daily || dailyTotals.length === 0) return;
    const headers = ['Jour', 'Équipement', 'Énergie (kWh)', 'Coût (DT)', 'Anomalies'];
    const rows = data.daily.map(d => [
      String(d._id.day).padStart(2, '0'),
      d._id.type_equipement || '-',
      (d.total_kwh || 0).toFixed(3),
      (d.total_cost_dt || 0).toFixed(4),
      d.anomaly_count || 0,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title gradient-text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={22} /> Rapports mensuel
          </h1>
          <p className="page-subtitle">Analyse de la consommation énergétique par mois et par zone</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }} onClick={() => setMonth(m => addMonths(m, -1))}>
            <ChevronLeft size={16} />
          </button>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="glass-input"
            style={{ width: 'auto', padding: '0.4rem 0.75rem', colorScheme: 'light' }}
          />
          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }} onClick={() => setMonth(m => addMonths(m, 1))}>
            <ChevronRight size={16} />
          </button>
          <button className="btn btn-emerald" style={{ padding: '0.4rem 0.9rem', fontSize: '0.75rem', marginLeft: '0.5rem' }} onClick={exportCSV} disabled={!data?.daily}>
            📥 Export CSV
          </button>
        </div>
      </div>
      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="loader-spin" style={{ width: 40, height: 40 }} />
        </div>
      ) : !data || dailyTotals.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Aucune donnée pour {month}. Lancez le simulateur pour collecter des données.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span className="kpi-label">Énergie totale</span>
              <div className="kpi-value" style={{ color: '#10b981' }}>{fmt(grandTotal.kwh, 2)}<span className="kpi-unit"> kWh</span></div>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span className="kpi-label">Coût total</span>
              <div className="kpi-value" style={{ color: '#f59e0b' }}>{fmt(grandTotal.cost, 3)}<span className="kpi-unit"> DT</span></div>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span className="kpi-label">Anomalies</span>
              <div className="kpi-value" style={{ color: '#ef4444' }}>{grandTotal.anomalies}</div>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span className="kpi-label">Jours avec données</span>
              <div className="kpi-value" style={{ color: '#4f46e5' }}>{dailyTotals.length}</div>
            </div>
          </div>

          {/* Per-equipment summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {Object.entries(equipTotals).map(([equip, t]) => {
              const c = EQUIP_COLORS[equip] || '#6366f1';
              const pct = grandTotal.kwh > 0 ? (t.kwh / grandTotal.kwh * 100) : 0;
              return (
                <div key={equip} className="glass-panel" style={{ padding: '1.25rem', borderColor: c + '30' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700 }}>{equip}</span>
                    <span className="badge" style={{ background: c + '20', color: c, border: '1px solid ' + c + '40' }}>{fmt(pct, 1)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(15,23,42,0.08)', borderRadius: 2, marginBottom: '0.75rem' }}>
                    <div style={{ height: '100%', width: pct + '%', background: c, borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Énergie</div>
                      <div style={{ fontWeight: 700, color: c }}>{fmt(t.kwh, 2)} kWh</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Coût</div>
                      <div style={{ fontWeight: 700, color: '#b45309' }}>{fmt(t.cost, 3)} DT</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daily energy chart */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Consommation journalière (kWh)</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyTotals} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.07)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} unit=" kWh" />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, fontSize: 12, color: 'rgba(15,23,42,0.9)' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                {Object.entries(EQUIP_COLORS).map(([e, c]) => (
                  <Bar key={e} dataKey={e + '_kwh'} name={e} fill={c} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily cost chart */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Coût journalier (DT)</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyTotals} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.07)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(100,116,139,0.8)' }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 8, fontSize: 12, color: 'rgba(15,23,42,0.9)' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                {Object.entries(EQUIP_COLORS).map(([e, c]) => (
                  <Bar key={e} dataKey={e + '_cost'} name={e + ' coût'} fill={c} opacity={0.75} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
