const Tariff = require('../models/Tariff');

const SIMULATOR_INTERVAL_S = 10;

function getTariffType(timestamp, tariff) {
  const hour   = new Date(timestamp).getHours();
  const isPeak = hour >= tariff.peak_hours.start && hour < tariff.peak_hours.end;
  return {
    tariffType: isPeak ? 'heure_pleine' : 'heure_creuse',
    ratePerKwh: isPeak ? tariff.heure_pleine : tariff.heure_creuse,
  };
}

exports.calculateCost = async (power_w, timestamp) => {
  const tariff = await Tariff.findOne({ is_active: true }).lean();
  if (!tariff) throw new Error('Aucun tarif actif. Lance seed-tariffs.js');

  const delta_h    = SIMULATOR_INTERVAL_S / 3600;
  const energy_kwh = (power_w / 1000) * delta_h;

  const { tariffType, ratePerKwh } = getTariffType(timestamp, tariff);
  const cost_dt = energy_kwh * ratePerKwh;

  return {
    energy_kwh:  parseFloat(energy_kwh.toFixed(6)),
    cost_dt:     parseFloat(cost_dt.toFixed(6)),
    tariff_type: tariffType,
  };
};
