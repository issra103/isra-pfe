import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const ZONE_COLORS = { 'Zone1': '#3b82f6', 'Zone2': '#f59e0b', 'Zone3': '#8b5cf6' };

/**
 * data: raw flat readings array (mixed zones)
 * Pivots into time-bucketed rows: { timestamp, Zone1, Zone2, Zone3, Zone1_pred, ... }
 */
function pivotByTime(readings) {
  const map = new Map();
  for (const r of readings) {
    const key = r.timestamp;
    if (!map.has(key)) map.set(key, { timestamp: key });
    const row = map.get(key);
    row[r.zone]               = r.power_w;
    row[`${r.zone}_pred`]     = r.predicted_next_w ?? undefined;
    row[`${r.zone}_anomaly`]  = r.is_anomaly ? r.power_w : undefined;
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export default function LiveLineChart({ data }) {
  const pivoted = pivotByTime(data);

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Consommation en temps réel par zone (W)
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={pivoted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => new Date(v).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleTimeString()}
            formatter={(val, name) => [val ? `${Number(val).toLocaleString()} W` : '—', name]}
          />
          <Legend />
          {['Zone1', 'Zone2', 'Zone3'].map(zone => (
            <Line
              key={zone}
              type="monotone"
              dataKey={zone}
              name={zone}
              stroke={ZONE_COLORS[zone]}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
          {['Zone1', 'Zone2', 'Zone3'].map(zone => (
            <Line
              key={`${zone}_pred`}
              type="monotone"
              dataKey={`${zone}_pred`}
              name={`${zone} IA`}
              stroke={ZONE_COLORS[zone]}
              dot={false}
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

