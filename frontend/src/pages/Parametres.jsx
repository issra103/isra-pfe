import { useState, useEffect, useCallback } from 'react';
import { getSimulatorStatus, startSimulator, stopSimulator } from '../api/energyApi';
import axios from 'axios';
import {
  RefreshCw, Play, Square, Cpu, Server, Info, CreditCard,
  Check, Pencil, X as XIcon
} from 'lucide-react';

function StatusBadge({ ok, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        className={ok ? 'pulse-dot' : ''}
        style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--accent-emerald)' : '#94a3b8', flexShrink: 0 }}
      />
      <span style={{ fontSize: '0.8rem', color: ok ? '#059669' : '#64748b' }}>{label}</span>
    </div>
  );
}

const DEFAULT_TARIFFS = [
  { label: 'Heure creuse (00h–08h)',    rate: 0.150, color: '#10b981' },
  { label: 'Heure normale (08h–17h)',   rate: 0.250, color: '#6366f1' },
  { label: 'Heure de pointe (17h–22h)', rate: 0.350, color: '#f59e0b' },
  { label: 'Heure normale (22h–00h)',   rate: 0.250, color: '#4f46e5' },
];

function TariffRow({ item, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(item.rate.toFixed(3)));

  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) { onSave(v); setEditing(false); }
  };
  const cancel = () => { setDraft(String(item.rate.toFixed(3))); setEditing(false); };

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.625rem 0.75rem',
      background: item.color + '10', borderRadius: '0.625rem',
      border: '1px solid ' + item.color + '30',
    }}>
      <span style={{ fontSize: '0.8rem', color: '#0f172a' }}>{item.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {editing ? (
          <>
            <input
              className="glass-input"
              type="number"
              step="0.001"
              min="0.001"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              autoFocus
              style={{ width: 90, padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace', textAlign: 'right' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DT/kWh</span>
            <button onClick={commit} className="btn btn-emerald" style={{ padding: '0.25rem 0.5rem' }}><Check size={13} /></button>
            <button onClick={cancel} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }}><XIcon size={13} /></button>
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>
              {item.rate.toFixed(3)} DT/kWh
            </span>
            <button
              onClick={() => { setDraft(String(item.rate.toFixed(3))); setEditing(true); }}
              className="btn btn-ghost"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              <Pencil size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Parametres() {
  const [simStatus, setSimStatus]         = useState('unknown');
  const [simLoading, setSimLoading]       = useState(false);
  const [backendOk, setBackendOk]         = useState(null);
  const [aiOk, setAiOk]                   = useState(null);
  const [checksLoading, setChecksLoading] = useState(true);
  const [tariffs, setTariffs]             = useState(DEFAULT_TARIFFS);
  const [saved, setSaved]                 = useState(false);

  const checkServices = useCallback(async () => {
    setChecksLoading(true);
    await Promise.allSettled([
      getSimulatorStatus().then(s => setSimStatus(s.status)).catch(() => setSimStatus('unknown')),
      axios.get('http://localhost:4000/api/energy/kpis', { timeout: 3000 }).then(() => setBackendOk(true)).catch(() => setBackendOk(false)),
      axios.get('http://localhost:8000/health', { timeout: 3000 }).then(() => setAiOk(true)).catch(() => setAiOk(false)),
    ]);
    setChecksLoading(false);
  }, []);

  useEffect(() => { checkServices(); }, [checkServices]);

  const toggleSim = async () => {
    setSimLoading(true);
    try {
      if (simStatus === 'running') { await stopSimulator(); setSimStatus('stopped'); }
      else { await startSimulator(); setSimStatus('running'); }
    } catch (_) {}
    setSimLoading(false);
  };

  const updateTariff = (index, newRate) => {
    setTariffs(prev => prev.map((t, i) => i === index ? { ...t, rate: newRate } : t));
  };

  const handleSaveAll = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isRunning = simStatus === 'running';

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title gradient-text">Paramètres</h1>
          <p className="page-subtitle">Configuration du système, services et informations sur la pile technique</p>
        </div>
        <button className="btn btn-ghost" onClick={checkServices} disabled={checksLoading}>
          <RefreshCw size={14} style={checksLoading ? { animation: 'spin 0.8s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>
      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

        {/* Simulator control */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderColor: isRunning ? 'rgba(5,150,105,0.3)' : 'rgba(15,23,42,0.09)' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
            <Cpu size={16} style={{ color: 'var(--accent-indigo)' }} />
            Simulateur IoT
            <span className={`badge ${isRunning ? 'badge-emerald' : ''}`} style={{ marginLeft: 4 }}>
              {isRunning ? '● Actif' : simStatus === 'stopped' ? '○ Arrêté' : '? Inconnu'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Le simulateur lit le fichier CSV STEG et envoie des lectures via HTTP POST au backend toutes les 10 secondes. Données générées pour 3 zones (Zone1, Zone2, Zone3).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
            {[
              { label: 'Fréquence', value: '1 lecture / 10s' },
              { label: 'Zones', value: 'Zone1, Zone2, Zone3' },
              { label: 'Source', value: 'powerconsumption.csv' },
              { label: 'Endpoint', value: 'POST /api/iot/data' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '0.625rem', background: 'rgba(15,23,42,0.03)', borderRadius: '0.5rem', border: '1px solid rgba(15,23,42,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.75rem', fontFamily: 'monospace', color: '#0f172a' }}>{value}</div>
              </div>
            ))}
          </div>
          <button
            className={isRunning ? 'btn btn-red' : 'btn btn-emerald'}
            onClick={toggleSim}
            disabled={simLoading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {simLoading
              ? <span className="loader-spin" />
              : isRunning ? <Square size={14} /> : <Play size={14} />
            }
            {simLoading ? '...' : isRunning ? 'Arrêter le simulateur' : 'Démarrer le simulateur'}
          </button>
        </div>

        {/* Service health */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
            <Server size={16} style={{ color: 'var(--accent-indigo)' }} />
            État des services
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { name: 'Backend API (Node.js)', port: 4000, ok: backendOk, desc: 'Express + Mongoose · MongoDB energywatch', tech: 'Node.js 18 · Express 4.18' },
              { name: 'Service IA (FastAPI)',   port: 8000, ok: aiOk,      desc: 'Random Forest · Isolation Forest · scikit-learn', tech: 'Python 3.11 · FastAPI · uvicorn' },
              { name: 'Frontend (Vite + React)',port: 3000, ok: true,      desc: "Interface en cours d'exécution", tech: 'React 18 · Vite · Tailwind CSS' },
            ].map(svc => (
              <div key={svc.name} style={{ padding: '1rem', background: 'rgba(15,23,42,0.03)', borderRadius: '0.75rem', border: '1px solid rgba(15,23,42,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{svc.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-subtle)' }}>:{svc.port}</span>
                    <StatusBadge ok={svc.ok} label={svc.ok === null ? 'Vérif...' : svc.ok ? 'En ligne' : 'Hors ligne'} />
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{svc.desc}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: 2, fontFamily: 'monospace' }}>{svc.tech}</div>
              </div>
            ))}
          </div>
        </div>

        {/* System info */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
            <Info size={16} style={{ color: 'var(--accent-indigo)' }} />
            Informations système
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Projet',           value: 'EnergyWatch — PFE ESPRIT' },
              { label: 'Version',          value: 'v1.0.0' },
              { label: 'Base de données',  value: 'MongoDB localhost:27017' },
              { label: 'Collection',       value: 'energywatch.sensordatas' },
              { label: 'Architecture',     value: 'IoT → Backend → IA → Frontend' },
              { label: 'Protocoles',       value: 'HTTP REST + Socket.io' },
              { label: 'Modèle prévision', value: 'Random Forest Regressor' },
              { label: 'Modèle détection', value: 'Isolation Forest (5%)' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{
                  fontSize: '0.8rem', fontWeight: 600, color: '#0f172a',
                  fontFamily: label.includes('Collection') || label.includes('Base') ? 'monospace' : 'inherit'
                }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editable tariff config */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, color: '#b45309' }}>
              <CreditCard size={16} />
              Configuration tarifaire STEG
            </div>
            <button
              className={saved ? 'btn btn-emerald' : 'btn btn-primary'}
              onClick={handleSaveAll}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            >
              {saved ? <><Check size={13} /> Sauvegardé</> : 'Appliquer'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {tariffs.map((t, i) => (
              <TariffRow key={t.label} item={t} onSave={rate => updateTariff(i, rate)} />
            ))}
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-subtle)', lineHeight: 1.5 }}>
            Cliquez sur l'icône crayon pour modifier un tarif. Appuyez sur Entrée ou ✓ pour confirmer.
          </p>
        </div>

      </div>
    </div>
  );
}
