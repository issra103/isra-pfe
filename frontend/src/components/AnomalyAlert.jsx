import { useEffect, useState } from 'react';

export default function AnomalyAlert({ anomaly, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (anomaly) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 15000);
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
          Capteur <strong>{anomaly.sensor_id}</strong> — Zone{' '}
          <strong>{anomaly.batiment_id}</strong>
        </p>
        <p className="text-sm opacity-90">
          Puissance : <strong>{anomaly.power_w?.toLocaleString()} W</strong>
        </p>
      </div>
      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        className="text-white hover:text-red-200 text-xl font-bold leading-none"
      >
        ✕
      </button>
    </div>
  );
}
