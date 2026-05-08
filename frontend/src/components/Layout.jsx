import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Activity, ShieldAlert, TrendingUp,
  BarChart2, Layers, Lightbulb, Settings, Zap
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',                label: 'Tableau de bord',   Icon: LayoutDashboard, section: 'Principal' },
  { to: '/flux',            label: 'Flux en direct',     Icon: Activity,        section: 'Principal' },
  { to: '/anomalies',       label: 'Anomalies IA',       Icon: ShieldAlert,     section: 'Analyse' },
  { to: '/previsions',      label: 'Prévisions IA',      Icon: TrendingUp,      section: 'Analyse' },
  { to: '/rapports',        label: 'Rapports mensuel',   Icon: BarChart2,       section: 'Rapports' },
  { to: '/zones',           label: 'Zones énergétiques', Icon: Layers,          section: 'Rapports' },
  { to: '/recommandations', label: 'Recommandations',    Icon: Lightbulb,       section: 'Gestion' },
  { to: '/parametres',      label: 'Paramètres',         Icon: Settings,        section: 'Gestion' },
];

function groupBySection(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});
}

export default function Layout() {
  const grouped = groupBySection(NAV_ITEMS);

  return (
    <>
      <div className="bg-glow" />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Zap size={18} color="white" />
          </div>
          <div>
            <div className="sidebar-logo-text">EnergyWatch</div>
            <div className="sidebar-logo-sub">IoT Monitor</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflow: 'auto' }}>
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <item.Icon size={15} style={{ flexShrink: 0 }} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: '0 0.5rem', marginTop: 'auto' }}>
          <div className="holo-line" style={{ marginBottom: '1rem' }} />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>EnergyWatch v1.0</div>
            <div>Projet PFE — ISRA 2025</div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="main-content">
        <Outlet />
      </main>
    </>
  );
}
