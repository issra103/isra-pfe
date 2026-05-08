require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Tariff   = require('../models/Tariff');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Seed] Connecte a MongoDB');

  await Tariff.deleteMany({});

  const tariff = new Tariff({
    name:         'STEG Basse Tension 2026',
    heure_pleine: 0.250,
    heure_creuse: 0.150,
    peak_hours:   { start: 8, end: 22 },
    is_active:    true,
  });

  await tariff.save();
  console.log('[Seed] Tarif cree :', JSON.stringify(tariff.toObject(), null, 2));

  await mongoose.disconnect();
  console.log('[Seed] Termine.');
}

seed().catch(console.error);
