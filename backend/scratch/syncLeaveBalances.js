const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const LeaveBalance = require('../models/LeaveBalance');

const fixLeaveBalances = async () => {
  try {
    const uri = process.env.MONGO_URI; // Corrected key: MONGO_URI
    if (!uri) throw new Error('MONGO_URI not found in process.env');

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const result = await LeaveBalance.updateMany(
      {},
      { 
        $set: { 
          'sick.total': 6,
          'casual.total': 12,
          'religious.total': 2
        } 
      }
    );

    console.log(`Updated totals for ${result.modifiedCount} records...`);

    const allBalances = await LeaveBalance.find();
    console.log(`Recalculating math for ${allBalances.length} records...`);

    for (const lb of allBalances) {
      if (lb.sick) {
        lb.sick.remaining = Math.max(0, 6 - (lb.sick?.used || 0));
        lb.markModified('sick');
      }
      if (lb.casual) {
        lb.casual.remaining = Math.max(0, 12 - (lb.casual?.used || 0));
        lb.markModified('casual');
      }
      if (lb.religious) {
        lb.religious.remaining = Math.max(0, 2 - (lb.religious?.used || 0));
        lb.markModified('religious');
      }
      await lb.save();
    }

    console.log(`Successfully synchronized all leave balances.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

fixLeaveBalances();
