export default function KpiCard({ title, value, unit, color = 'blue', icon }) {
  const colors = {
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
    green:  'bg-green-50  border-green-200  text-green-700',
    red:    'bg-red-50    border-red-200    text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className={`rounded-2xl border-2 p-5 shadow-sm ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-70">{title}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold">
        {value ?? '—'}
        <span className="text-base font-normal ml-1 opacity-60">{unit}</span>
      </p>
    </div>
  );
}
