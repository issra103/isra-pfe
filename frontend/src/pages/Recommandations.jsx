import { useState, useEffect } from 'react';
import { getKPIs } from '../api/energyApi';

const EQUIP_COLORS = { Climatisation: '#10b981', Serveur: '#6366f1', 'Éclairage': '#f59e0b' };

const STATIC_TIPS = [
  {
    icon: '🌙',
    title: 'Exploitez les heures creuses STEG',
    desc: 'Les tarifs STEG sont réduits de 00h00 à 07h59. Planifiez les tâches énergivores (chauffe-eau, machines industrielles, recharge) pendant cette fenêtre.',
    tag: 'Tarif',
    color: '#6366f1',
    saving: 'Jusqu\'à -40% coût',
  },
  {
    icon: '⚡',
    title: 'Évitez les pics en heure de pointe',
    desc: 'De 17h00 à 21h00, la facturation STEG est au tarif maximum. Différez les équipements non-urgents ou activez la régulation de puissance.',
    tag: 'Pic',
    color: '#f59e0b',
    saving: 'Jusqu\'à -25% coût',
  },
  {
    icon: '🔄',
    title: 'Maintenance préventive des équipements',
    desc: 'Un équipement mal entretenu consomme jusqu\'à 30% d\'énergie supplémentaire. Planifiez une révision dès que la puissance dépasse le seuil nominal.',
    tag: 'Maintenance',
    color: '#10b981',
    saving: 'Économie 15-30%',
  },
  {
    icon: '📊',
    title: 'Facteur de puissance (cos φ)',
    desc: 'Un mauvais facteur de puissance entraîne des pénalités STEG. Installez des condensateurs de compensation si cos φ < 0,85.',
    tag: 'Qualité',
    color: '#ec4899',
    saving: 'Évite pénalités',
  },
];

function generateDynamicTips(kpis) {
  if (!kpis) return [];
  const tips = [];
  const equips = kpis.equipements || [];

  // Equipment with highest cost
  const sorted = [...equips].sort((a, b) => (b.total_cost_dt || 0) - (a.total_cost_dt || 0));
  if (sorted[0]) {
    const c = EQUIP_COLORS[sorted[0].type_equipement] || '#f59e0b';
    tips.push({
      icon: '💡',
      title: `Réduire la charge : ${sorted[0].type_equipement}`,
      desc: `${sorted[0].type_equipement} est l'équipement le plus coûteux avec ${Number(sorted[0].total_cost_dt || 0).toFixed(4)} DT. Vérifiez les cycles d'utilisation et optimisez.`,
      tag: 'Coût élevé',
      color: c,
      saving: 'Priorité #1',
      dynamic: true,
    });
  }

  // High anomaly count
  if (kpis.anomaly_count > 5) {
    tips.push({
      icon: '🔴',
      title: 'Investigation des capteurs requise',
      desc: `${kpis.anomaly_count} anomalies détectées aujourd'hui. Des lectures anormales peuvent indiquer des défauts d'équipements ou des problèmes de câblage. Consultez la page Anomalies.`,
      tag: 'Anomalies',
      color: '#ef4444',
      saving: 'Action urgente',
      dynamic: true,
    });
  }

  // Equipment with highest avg consumption
  const sortedByPower = [...equips].sort((a, b) => (b.avg_consumption || 0) - (a.avg_consumption || 0));
  if (sortedByPower[0] && sortedByPower[0].avg_consumption > 3000) {
    const c = EQUIP_COLORS[sortedByPower[0].type_equipement] || '#6366f1';
    tips.push({
      icon: '📉',
      title: `Optimiser le planning : ${sortedByPower[0].type_equipement}`,
      desc: `Puissance moyenne de ${Number(sortedByPower[0].avg_consumption).toFixed(0)} W — au-dessus du seuil recommandé. Répartissez la charge sur des plages horaires différentes.`,
      tag: 'Surcharge',
      color: c,
      saving: 'Réduction charge',
      dynamic: true,
    });
  }

  return tips;
}

export default function Recommandations() {
  const [kpis, setKpis]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKPIs()
      .then(setKpis)
      .catch(() => setKpis(null))
      .finally(() => setLoading(false));
  }, []);

  const dynamicTips = generateDynamicTips(kpis);
  const allTips     = [...dynamicTips, ...STATIC_TIPS];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title gradient-text">Recommandations</h1>
        <p className="page-subtitle">Conseils personnalisés basés sur vos données &mdash; tarification STEG</p>
      </div>
      <div className="holo-line" style={{ marginBottom: '1.5rem' }} />

      {/* STEG tariff reference */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.875rem', fontSize: '0.9rem', color: '#4f46e5' }}>
          📋 Grille tarifaire STEG (référence)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Heure creuse', hours: '00h00 – 07h59', rate: '0.150 DT/kWh', color: '#10b981' },
            { label: 'Heure normale', hours: '08h00 – 16h59', rate: '0.250 DT/kWh', color: '#6366f1' },
            { label: 'Heure de pointe', hours: '17h00 – 21h59', rate: '0.350 DT/kWh', color: '#f59e0b' },
            { label: 'Heure normale (soir)', hours: '22h00 – 23h59', rate: '0.250 DT/kWh', color: '#4f46e5' },
          ].map(t => (
            <div key={t.label} style={{ padding: '0.75rem', background: 'rgba(15,23,42,0.03)', borderRadius: '0.75rem', border: '1px solid rgba(15,23,42,0.07)' }}>
              <div style={{ fontWeight: 700, color: t.color, fontSize: '0.8rem', marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{t.hours}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.rate}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic tips banner */}
      {dynamicTips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem' }}>
          <div className="pulse-dot" style={{ background: '#ef4444' }} />
          <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
            {dynamicTips.length} recommandation{dynamicTips.length > 1 ? 's' : ''} personnalisée{dynamicTips.length > 1 ? 's' : ''} générée{dynamicTips.length > 1 ? 's' : ''} depuis vos données actuelles
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loader-spin" style={{ width: 36, height: 36 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {allTips.map((tip, i) => (
            <div
              key={i}
              className="glass-panel"
              style={{ padding: '1.5rem', borderColor: tip.color + '25', position: 'relative', overflow: 'hidden' }}
            >
              {tip.dynamic && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: tip.color + '20', color: tip.color, fontSize: '0.65rem', padding: '2px 8px', borderBottomLeftRadius: 8, fontWeight: 700 }}>
                  PERSONNALISÉ
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>{tip.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{tip.title}</span>
                    <span className="badge" style={{ background: tip.color + '20', color: tip.color, border: '1px solid ' + tip.color + '40', fontSize: '0.65rem' }}>
                      {tip.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 0.75rem' }}>{tip.desc}</p>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: tip.color }}>{tip.saving}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
