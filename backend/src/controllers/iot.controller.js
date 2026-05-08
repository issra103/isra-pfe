const SensorData = require('../models/SensorData');
const { analyzeWithAI }  = require('../services/ai.service');
const { calculateCost }  = require('../services/financial.service');

exports.receiveData = async (req, res) => {
  try {
    const totalConsumption = (req.body.consumption_zone1 || 0)
                           + (req.body.consumption_zone2 || 0)
                           + (req.body.consumption_zone3 || 0);

    const doc = new SensorData({
      datetime:            new Date(req.body.datetime),
      type_equipement:     req.body.type_equipement,
      is_manual_anomaly:   req.body.is_manual_anomaly ?? false,
      ai_detected_anomaly: false,
      temperature:         req.body.temperature,
      humidity:            req.body.humidity,
      windSpeed:           req.body.windSpeed,
      generalDiffuseFlows: req.body.generalDiffuseFlows,
      diffuseFlows:        req.body.diffuseFlows,
      consumption_zone1:   req.body.consumption_zone1,
      consumption_zone2:   req.body.consumption_zone2,
      consumption_zone3:   req.body.consumption_zone3,
      totalConsumption:    totalConsumption,
    });

    await doc.save();
    console.log(`[IoT] ${doc.type_equipement} | ${doc.totalConsumption.toFixed(1)} W total`);

    res.status(201).json({ success: true, id: doc._id });

    // Async enrichment
    setImmediate(async () => {
      try {
        const aiResult  = await analyzeWithAI({ ...req.body, datetime: doc.datetime, totalConsumption });
        const financial = await calculateCost(totalConsumption, doc.datetime);

        const predicted = aiResult.predicted_next_w || null;

        await SensorData.findByIdAndUpdate(doc._id, {
          ai_detected_anomaly:  aiResult.is_anomaly,
          predicted_next_hour:  predicted,
          energy_kwh:           financial.energy_kwh,
          cost_est:             financial.cost_dt,
          is_peak_hour:         financial.tariff_type === 'heure_pleine',
        });

        const io = req.app.get('io');

        io.emit('new_reading', {
          ...doc.toObject(),
          ai_detected_anomaly:  aiResult.is_anomaly,
          predicted_next_hour:  predicted,
          energy_kwh:           financial.energy_kwh,
          cost_est:             financial.cost_dt,
          is_peak_hour:         financial.tariff_type === 'heure_pleine',
        });

        if (aiResult.is_anomaly) {
          console.warn(`[ANOMALIE] ${doc.type_equipement} | ${totalConsumption.toFixed(1)} W`);
          io.emit('anomaly_detected', {
            type_equipement: doc.type_equipement,
            totalConsumption,
            datetime: doc.datetime,
          });
        }
      } catch (err) {
        console.error('[Async Error]', err.message);
      }
    });

  } catch (err) {
    console.error('[IoT Controller]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
