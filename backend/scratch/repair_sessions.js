const mongoose = require('mongoose');
const Task = require('../models/Task');
const WorkSession = require('../models/WorkSession');
require('dotenv').config();

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

async function repair() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find all active sessions started in the last 6 hours that seem to be un-shifted
        // Current time is roughly 12:40 PM IST (07:10 AM UTC)
        // A shifted session should be around 12:40 PM UTC.
        // An un-shifted session would be around 07:10 AM UTC.
        
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

        const activeSessions = await WorkSession.find({
            endTime: null,
            startTime: { $gte: sixHoursAgo }
        });

        console.log(`Found ${activeSessions.length} active sessions to check.`);

        for (const session of activeSessions) {
            const hour = session.startTime.getUTCHours();
            // If the hour is < 8, it's likely a UTC time that should have been shifted (+5.5h)
            // e.g., 7 AM UTC should be 12:30 PM UTC (IST-as-UTC)
            if (hour < 8) {
                const oldStart = session.startTime;
                const newStart = new Date(oldStart.getTime() + IST_OFFSET);
                session.startTime = newStart;
                await session.save();
                console.log(`Repaired session ${session._id}: ${oldStart.toISOString()} -> ${newStart.toISOString()}`);
            } else {
                console.log(`Session ${session._id} already looks correct (Hour: ${hour})`);
            }
        }

        console.log('Repair complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

repair();
