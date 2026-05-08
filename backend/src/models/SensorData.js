const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  datetime:            { type: Date, required: true },
  type_equipement:     { type: String, enum: ['Climatisation', 'Serveur', 'Éclairage'], required: true },
  is_manual_anomaly:   { type: Boolean, default: false },
  ai_detected_anomaly: { type: Boolean, default: false },
  temperature:         { type: Number },
  humidity:            { type: Number },
  windSpeed:           { type: Number },
  generalDiffuseFlows: { type: Number },
  diffuseFlows:        { type: Number },
  consumption_zone1:   { type: Number, required: true },
  consumption_zone2:   { type: Number, required: true },
  consumption_zone3:   { type: Number, required: true },
  totalConsumption:    { type: Number, required: true },
  cost_est:              { type: Number, default: null },
  energy_kwh:            { type: Number, default: null },
  is_peak_hour:          { type: Boolean, default: false },
  predicted_next_hour:   { type: Number, default: null },
}, { timestamps: true });

sensorDataSchema.index({ datetime: -1 });
sensorDataSchema.index({ type_equipement: 1, datetime: -1 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
