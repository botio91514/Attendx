const cron = require('node-cron');
const LeaveBalance = require('../models/LeaveBalance');
const AuditLog = require('../models/AuditLog');

// 🔁 YEARLY LEAVE RESET logic
// Runs every Jan 1st at 00:01
cron.schedule('1 0 1 1 *', async () => {
  console.log('📅 Starting Yearly Leave Reset...');
  try {
    const nextYear = new Date().getFullYear();
    
    // In many policies, we don't just "reset" the old document, 
    // we create a new one for the next year. 
    // This script will create/initialize records for everyone for the new year.
    const User = require('../models/User');
    const employees = await User.find({ role: 'employee', isActive: true });

    for (const emp of employees) {
      // Create new balance for the new year
      await LeaveBalance.findOneAndUpdate(
        { userId: emp._id, year: nextYear },
        { 
          $set: { 
            'casual.used': 0,
            'sick.used': 0,
            'religious.used': 0,
            'unpaid.used': 0
          }
        },
        { upsert: true, new: true }
      );
    }

    await AuditLog.create({
      action: 'SYSTEM_YEAR_RESET',
      details: `Yearly leave balance reset performed for ${nextYear}. All used counts set to 0.`
    });

    console.log('✅ Yearly Leave Reset Completed.');
  } catch (error) {
    console.error('❌ Yearly Leave Reset Failed:', error);
  }
});

console.log('⏰ Leave Reset Cron Scheduled (Jan 1 00:01)');
