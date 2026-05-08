const SensorData = require('../models/SensorData');

function getPeriodMatch(period) {
  if (!period || period === 'all') return {};
  const now = new Date();
  let start;
  if (period === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start = new Date(now); start.setDate(start.getDate() - 7);
  } else if (period === 'month') {
    start = new Date(now); start.setMonth(start.getMonth() - 1);
  } else {
    return {};
  }
  return { createdAt: { $gte: start } };
}

exports.getLatest = async (req, res) => {
  try {
    const data = await SensorData.find().sort({ datetime: -1 }).limit(50).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getKPIs = async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const match = getPeriodMatch(period);

    const [global, byEquipement] = await Promise.all([
      SensorData.aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        {
          $group: {
            _id:             null,
            total_kwh:       { $sum: '$energy_kwh' },
            total_cost_dt:   { $sum: '$cost_est' },
            anomaly_count:   { $sum: { $cond: [{ $or: ['$ai_detected_anomaly', '$is_manual_anomaly'] }, 1, 0] } },
            avg_consumption: { $avg: '$totalConsumption' },
            readings:        { $sum: 1 },
            peakCost:        { $sum: { $cond: [{ $eq: ['$is_peak_hour', true] }, '$cost_est', 0] } },
            offPeakCost:     { $sum: { $cond: [{ $eq: ['$is_peak_hour', false] }, '$cost_est', 0] } },
          },
        },
      ]),
      SensorData.aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        {
          $group: {
            _id:             '$type_equipement',
            total_kwh:       { $sum: '$energy_kwh' },
            total_cost_dt:   { $sum: '$cost_est' },
            anomaly_count:   { $sum: { $cond: [{ $or: ['$ai_detected_anomaly', '$is_manual_anomaly'] }, 1, 0] } },
            avg_consumption: { $avg: '$totalConsumption' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const defaults = { total_kwh: 0, total_cost_dt: 0, anomaly_count: 0, avg_consumption: 0, readings: 0, peakCost: 0, offPeakCost: 0 };
    res.json({
      ...(global[0] || defaults),
      period,
      equipements: byEquipement.map(e => ({
        type_equipement: e._id,
        total_kwh:       e.total_kwh,
        total_cost_dt:   e.total_cost_dt,
        anomaly_count:   e.anomaly_count,
        avg_consumption: e.avg_consumption,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMonthlyKPIs = async (req, res) => {
  try {
    const monthlyStats = await SensorData.aggregate([
      {
        $group: {
          _id: { year: { $year: '$datetime' }, month: { $month: '$datetime' } },
          consumption_zone1: { $sum: '$consumption_zone1' },
          consumption_zone2: { $sum: '$consumption_zone2' },
          consumption_zone3: { $sum: '$consumption_zone3' },
          totalConsumption:  { $sum: '$totalConsumption' },
          total_kwh:         { $sum: '$energy_kwh' },
          total_cost_dt:     { $sum: '$cost_est' },
          anomaly_count:     { $sum: { $cond: [{ $or: ['$ai_detected_anomaly', '$is_manual_anomaly'] }, 1, 0] } },
          readings:          { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthly = monthlyStats.map(s => {
      const zones = [
        { name: 'Zone1', val: s.consumption_zone1 },
        { name: 'Zone2', val: s.consumption_zone2 },
        { name: 'Zone3', val: s.consumption_zone3 },
      ];
      const topZone = zones.reduce((a, b) => (a.val > b.val ? a : b));
      return {
        Datetime: `${s._id.year}-${String(s._id.month).padStart(2, '0')}-01`,
        PowerConsumption_Zone1: s.consumption_zone1,
        PowerConsumption_Zone2: s.consumption_zone2,
        PowerConsumption_Zone3: s.consumption_zone3,
        TotalConsumption: s.totalConsumption,
        Energy_est_kWh: Number((s.total_kwh || 0).toFixed(2)),
        Cost_est_DT: Number((s.total_cost_dt || 0).toFixed(2)),
        TopZone: topZone.name,
        TopZoneSharePct: s.totalConsumption > 0 ? Number(((topZone.val / s.totalConsumption) * 100).toFixed(1)) : 0,
        anomaly_count: s.anomaly_count,
        readings: s.readings,
      };
    });

    const totalCost = monthly.reduce((s, r) => s + r.Cost_est_DT, 0);
    const totalEnergy = monthly.reduce((s, r) => s + r.Energy_est_kWh, 0);

    res.json({ monthly, totalCost: +totalCost.toFixed(2), totalEnergy: +totalEnergy.toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAnomalies = async (req, res) => {
  try {
    const anomalies = await SensorData.find({
      $or: [{ ai_detected_anomaly: true }, { is_manual_anomaly: true }]
    }).sort({ datetime: -1 }).limit(50).lean();
    res.json(anomalies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    const [year, mon] = month ? month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
    const start = new Date(year, mon - 1, 1);
    const end   = new Date(year, mon, 1);

    const daily = await SensorData.aggregate([
      { $match: { datetime: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            day:             { $dayOfMonth: '$datetime' },
            type_equipement: '$type_equipement',
          },
          total_kwh:       { $sum: '$energy_kwh' },
          total_cost_dt:   { $sum: '$cost_est' },
          anomaly_count:   { $sum: { $cond: [{ $or: ['$ai_detected_anomaly', '$is_manual_anomaly'] }, 1, 0] } },
          avg_consumption: { $avg: '$totalConsumption' },
          readings:        { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1, '_id.type_equipement': 1 } },
    ]);

    res.json({ month: `${year}-${String(mon).padStart(2,'0')}`, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getZonesDetail = async (req, res) => {
  try {
    const zones = await SensorData.aggregate([
      {
        $group: {
          _id: null,
          total_kwh:           { $sum: '$energy_kwh' },
          total_cost_dt:       { $sum: '$cost_est' },
          anomaly_count:       { $sum: { $cond: [{ $or: ['$ai_detected_anomaly', '$is_manual_anomaly'] }, 1, 0] } },
          avg_zone1:           { $avg: '$consumption_zone1' },
          avg_zone2:           { $avg: '$consumption_zone2' },
          avg_zone3:           { $avg: '$consumption_zone3' },
          max_zone1:           { $max: '$consumption_zone1' },
          max_zone2:           { $max: '$consumption_zone2' },
          max_zone3:           { $max: '$consumption_zone3' },
          avg_total:           { $avg: '$totalConsumption' },
          readings:            { $sum: 1 },
        },
      },
    ]);

    const stats = zones[0] || {};
    res.json({
      zones: [
        { zone: 'Zone1', avg_w: stats.avg_zone1 || 0, max_w: stats.max_zone1 || 0 },
        { zone: 'Zone2', avg_w: stats.avg_zone2 || 0, max_w: stats.max_zone2 || 0 },
        { zone: 'Zone3', avg_w: stats.avg_zone3 || 0, max_w: stats.max_zone3 || 0 },
      ],
      total_kwh:     stats.total_kwh || 0,
      total_cost_dt: stats.total_cost_dt || 0,
      anomaly_count: stats.anomaly_count || 0,
      avg_total:     stats.avg_total || 0,
      readings:      stats.readings || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPredictions = async (req, res) => {
  try {
    const data = await SensorData.find({ energy_kwh: { $ne: null } })
      .sort({ datetime: -1 }).limit(100).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
