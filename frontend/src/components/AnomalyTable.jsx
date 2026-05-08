export default function AnomalyTable({ anomalies }) {
  if (!anomalies?.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Historique des anomalies</h2>
        <p className="text-sm text-gray-400 text-center py-6">Aucune anomalie détectée</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Historique des anomalies
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          {anomalies.length}
        </span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b text-xs uppercase tracking-wider">
              <th className="pb-2 pr-4">Heure</th>
              <th className="pb-2 pr-4">Capteur</th>
              <th className="pb-2 pr-4">Zone</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Puissance</th>
              <th className="pb-2 text-right">Coût DT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {anomalies.map((a) => (
              <tr key={a._id} className="hover:bg-red-50 transition-colors">
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                  {new Date(a.timestamp).toLocaleTimeString('fr-TN')}
                </td>
                <td className="py-2 pr-4 font-mono font-semibold text-gray-800">{a.sensor_id}</td>
                <td className="py-2 pr-4">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                    {a.zone}
                  </span>
                </td>
                <td className="py-2 pr-4 text-gray-600">{a.type_equipement}</td>
                <td className="py-2 pr-4 text-right font-semibold text-red-600">
                  {Number(a.power_w).toLocaleString()} W
                </td>
                <td className="py-2 text-right text-gray-600">
                  {a.cost_dt ? a.cost_dt.toFixed(4) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
