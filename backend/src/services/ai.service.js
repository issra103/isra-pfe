const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

exports.analyzeWithAI = async (data) => {
  try {
    const ts          = new Date(data.datetime || Date.now());
    const jsDay       = ts.getDay();
    const day_of_week = jsDay === 0 ? 6 : jsDay - 1;   // 0=Monday

    const totalConsumption = data.totalConsumption
      || (data.consumption_zone1 || 0) + (data.consumption_zone2 || 0) + (data.consumption_zone3 || 0);

    const response = await axios.post(`${AI_URL}/predict`, {
      power_w:                totalConsumption,
      temperature:            data.temperature ?? 20,
      humidity:               data.humidity    ?? 50,
      hour:                   ts.getHours(),
      day_of_week,
      month:                  ts.getMonth() + 1,
      wind_speed:             data.windSpeed              ?? 0,
      general_diffuse_flows:  data.generalDiffuseFlows    ?? 0,
      diffuse_flows:          data.diffuseFlows           ?? 0,
    }, { timeout: 3000 });

    return response.data;
  } catch (err) {
    console.warn('[AI Service] Indisponible :', err.message);
    return { is_anomaly: false, predicted_next_w: null };
  }
};
