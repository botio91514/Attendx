const cron = require('node-cron');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

/**
 * 📈 MONTHLY CL ACCRUAL
 * Policy: Add 1 CL on the 1st of every month, cap at 12
 * Schedule: 00:05 on the 1st day of every month
 */
cron.schedule('5 0 1 * *', async () => {
  console.log('📅 [CRON] Starting Monthly Casual Leave Accrual...');
  try {
    const employees = await User.find({ isActive: true });
    let updatedCount = 0;

    for (const emp of employees) {
      const currentCL = emp.leaveBalance?.cl || 0;
      if (currentCL < 12) {
        // Increment by 1, but cap at 12
        const nextCL = Math.min(12, currentCL + 1);
        
        await User.findByIdAndUpdate(emp._id, {
          $set: { 'leaveBalance.cl': nextCL }
        });
        updatedCount++;
      }
    }

    console.log(`✅ [CRON] Monthly CL Accrual Completed. Updated ${updatedCount} employees.`);
    
    // Internal Audit Log (System Action)
    await logAudit({
      action: 'SYSTEM_ACCRUAL',
      module: 'leave',
      details: `Monthly CL accrual (+1) performed for ${updatedCount} active employees.`
    });
  } catch (error) {
    console.error('❌ [CRON] Monthly CL Accrual Failed:', error);
  }
});

/**
 * 🔁 YEARLY LEAVE RESET
 * Policy: Reset SL to 6, RL to 2, and keep CL as is (or reset to 0/1 depending on policy)
 * Based on user prompt: SL: 6/year, RL: 2/year
 * Schedule: 00:01 on January 1st
 */
cron.schedule('1 0 1 1 *', async () => {
  console.log('📅 [CRON] Starting Yearly Leave Reset...');
  try {
    // Reset SL and RL to defaults for the new year. 
    // CL stays or resets? Usually reset. Let's reset to 1 (first month accrual)
    const result = await User.updateMany(
      { isActive: true },
      { 
        $set: { 
          'leaveBalance.cl': 1, // New year starts with 1 CL for Jan
          'leaveBalance.sl': 6, 
          'leaveBalance.rl': 2 
        } 
      }
    );

    console.log(`✅ [CRON] Yearly Leave Reset Completed. Reset ${result.modifiedCount} employees.`);
    
    await logAudit({
      action: 'SYSTEM_YEAR_RESET',
      module: 'leave',
      details: `Yearly reset performed. SL set to 6, RL to 2, CL initialized to 1 for the new year.`
    });
  } catch (error) {
    console.error('❌ [CRON] Yearly Leave Reset Failed:', error);
  }
});

console.log('🚀 [CRON] Leave Management Jobs Registered (Monthly Accrual & Yearly Reset)');
