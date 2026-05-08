import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { getLatest, getSimulatorStatus, startSimulator, stopSimulator } from '../api/energyApi';
import { Wifi, WifiOff } from 'lucide-react';

function fmt(n, d = 1) { return n != null ? Number(n).toFixed(d) : '—'; }
function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

const EQUIP_ICON = { Climatisation: '❄️', Serveur: '🖥️', 'Éclairage': '💡' };

export default function FluxEnDirect() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [stats, setStats] = useState({ byType: {} });
  const logsRef = useRef([]);

  useEffect(() => {
    getLatest().then(data => {
      logsRef.current = data.slice(0, 30);
      setLogs([...logsRef.current]);
      computeStats(logsRef.current);
    }).catch(() => {});
    getSimulatorStatus().then(s => setSimRunning(s.running)).catch(() => {});
  }, []);

  function computeStats(data) {
    const byType = {};
    data.forEach(d => {
      byType[d.type_equipement] = (byType[d.type_equipement] || 0) + 1;
    });
    setStats({ byType });
  }

  const onNewReading = useCallback((data) => {
    const idx = logsRef.current.findIndex(r => r._id === data._id);
    if (idx !== -1) {
      logsRef.current[idx] = data;
    } else {
      logsRef.current = [data, ...logsRef.current].slice(0, 50);
    }
    setLogs([...logsRef.current]);
    computeStats(logsRef.current);
  }, []);

  const onConnect    = useCallback(() => setConnected(true),  []);
  const onDisconnect = useCallback(() => setConnected(false), []);

  useSocket(onNewReading, null, null, onConnect, onDisconnect);

  const toggleSim = async () => {
    setSimLoading(true);
    try {
      if (simRunning) { await stopSimulator(); setSimRunning(false); }
      else { await startSimulator(); setSimRunning(true); }
    } catch (_) {}
    setSimLoading(false);
  };

  const anomalyCount = logs.filter(l => l.is_manual_anomaly || l.ai_detected_anomaly).length;

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="pulse-dot" style={{ width: 12, height: 12, background: simRunning ? '#10b981' : '#ef4444', boxShadow: `0 0 10px ${simRunning ? '#10b981' : '#ef4444'}` }} />
            <h1 className="page-title gradient-text">Surveillance IoT en Direct</h1>
          </div>
          <p className="page-subtitle">Ingestion de données en temps réel depuis les capteurs et équipements</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {connected ? <Wifi size={14} style={{ color: '#059669' }} /> : <WifiOff size={14} style={{ color: '#94a3b8' }} />}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {connected ? 'Socket connecté' : 'Déconnecté'}
            </span>
          </div>
          <button
            className={simRunning ? 'btn btn-red' : 'btn btn-emerald'}
            onClick={toggleSim}
            disabled={simLoading}
            style={{ fontSize: '0.8rem' }}
          >
            {simLoading ? '⏳ ...' : simRunning ? '🛑 Arrêter' : '🚀 Démarrer'}
          </button>
        </div>
      </div>
      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span className="kpi-label">Messages récents</span>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{logs.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span className="kpi-label">Anomalies détectées</span>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{anomalyCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span className="kpi-label">Activité par équipement</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: '0.5rem' }}>
            {Object.entries(stats.byType).map(([type, count]) => (
              <span key={type} className="badge" style={{ fontSize: '0.7rem' }}>
                {EQUIP_ICON[type] || '📟'} {type}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Live log stream */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-dot" />
          Flux de données (Live Stream)
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{logs.length} entrées</span>
        </div>
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              En attente de données du simulateur...
            </div>
          ) : (
            logs.map((log, i) => {
              const isAnomaly = log.is_manual_anomaly || log.ai_detected_anomaly;
              return (
                <div key={log._id || i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem', borderRadius: 12, marginBottom: 6,
                  background: isAnomaly ? 'rgba(239,68,68,0.05)' : 'rgba(15,23,42,0.02)',
                  border: `1px solid ${isAnomaly ? 'rgba(239,68,68,0.2)' : 'var(--glass-border)'}`,
                  transition: 'all 0.3s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: isAnomaly ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>
                      {EQUIP_ICON[log.type_equipement] || '📟'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {log.type_equipement}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {fmtTime(log.datetime)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isAnomaly ? '#ef4444' : '#6366f1' }}>
                      {fmt(log.totalConsumption, 1)} W
                    </div>
                    {isAnomaly && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
                        ⚠️ Anomalie
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
