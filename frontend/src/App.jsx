import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Dashboard       from './pages/Dashboard';
import FluxEnDirect    from './pages/FluxEnDirect';
import Rapports        from './pages/Rapports';
import Previsions      from './pages/Previsions';
import AnomaliesPage   from './pages/AnomaliesPage';
import ZonesPage       from './pages/ZonesPage';
import Recommandations from './pages/Recommandations';
import Parametres      from './pages/Parametres';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index                    element={<Dashboard />} />
          <Route path="flux"              element={<FluxEnDirect />} />
          <Route path="rapports"          element={<Rapports />} />
          <Route path="previsions"        element={<Previsions />} />
          <Route path="anomalies"         element={<AnomaliesPage />} />
          <Route path="zones"             element={<ZonesPage />} />
          <Route path="recommandations"   element={<Recommandations />} />
          <Route path="parametres"        element={<Parametres />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

