const mongoose = require('mongoose');

const tariffSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  heure_pleine: { type: Number, required: true },
  heure_creuse: { type: Number, required: true },
  peak_hours: {
    start: { type: Number, default: 8  },
    end:   { type: Number, default: 22 },
  },
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Tariff', tariffSchema);
