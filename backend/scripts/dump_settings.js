require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

async function dump() {
  await mongoose.connect(process.env.MONGODB_URI);
  const items = await Settings.find();
  console.log("TOTAL SETTINGS DOCS:", items.length);
  console.log(JSON.stringify(items, null, 2));
  process.exit(0);
}
dump();
