require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('attendances');

    // Show all indexes
    const indexes = await collection.indexes();
    console.log('\nAll indexes:');
    indexes.forEach(i => console.log(' -', i.name, '->', JSON.stringify(i.key)));

    // Drop ALL non-_id indexes so we start clean
    for (const idx of indexes) {
      if (idx.name !== '_id_') {
        try {
          await collection.dropIndex(idx.name);
          console.log('Dropped index:', idx.name);
        } catch(e) {
          console.log('Could not drop:', idx.name, e.message);
        }
      }
    }

    // Delete ALL documents for today that have no checkIn set (ghost docs)
    const today = new Date().toISOString().split('T')[0];
    const result = await collection.deleteMany({ date: today, checkIn: null });
    console.log(`\nDeleted ${result.deletedCount} ghost document(s) for today (${today})`);

    // Show remaining docs for today  
    const remaining = await collection.find({ date: today }).toArray();
    console.log(`\nRemaining docs for today: ${remaining.length}`);
    remaining.forEach(d => console.log(' -', JSON.stringify({ userId: d.userId, date: d.date, checkIn: d.checkIn, status: d.status })));

    console.log('\nDone! Restart your backend (npm run dev) and try checking in.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

run();
