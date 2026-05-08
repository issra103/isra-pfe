import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function TariffBarChart({ data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Coût par zone et tranche horaire (DT)
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" DT" />
          <Tooltip formatter={(val) => [`${Number(val).toFixed(4)} DT`]} />
          <Legend />
          <Bar dataKey="heure_pleine" name="Heure Pleine" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="heure_creuse" name="Heure Creuse" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
