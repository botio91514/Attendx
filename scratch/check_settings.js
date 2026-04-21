const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const Settings = require('../backend/models/Settings');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const settings = await Settings.findOne();
    console.log('Settings:', settings);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
