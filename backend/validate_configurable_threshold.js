const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');

const runValidation = () => {
    console.log('--- SECTION 5: SETTINGS VALIDATION (minWorkMinutes = 60) ---');
    
    // Mock settings with 60-minute floor
    const settings = {
        halfDayThreshold: 5, // 300 minutes (Full day)
        minWorkMinutes: 60,   // Custom floor
        officeStartTime: '09:15',
        lateGracePeriod: 0
    };

    const cases = [
        { name: '45 min (Under 60)', work: 45, expectedStatus: 'absent', expectedFraction: 0 },
        { name: '1h 30m (90m, Over 60)', work: 90, expectedStatus: 'half-day', expectedFraction: 0.5 },
        { name: '5h (300m, Full Day)', work: 300, expectedStatus: 'present', expectedFraction: 1.0 }
    ];

    cases.forEach(tc => {
        const record = new Attendance({
            date: '2026-05-01',
            checkIn: new Date('2026-05-01T09:15:00Z'),
            checkOut: new Date(),
            totalBreakTime: 0
        });
        
        record.calculateWorkingHours = () => tc.work;

        const result = record.determineStatus(settings);
        
        const success = result.status === tc.expectedStatus && result.workFraction === tc.expectedFraction;
        
        console.log(`Test: ${tc.name}`);
        console.log(`   Result: Status=${result.status}, Fraction=${result.workFraction}`);
        console.log(`   Expected: Status=${tc.expectedStatus}, Fraction=${tc.expectedFraction}`);
        console.log(`   Success: ${success ? '✅' : '❌'}`);
    });
};

runValidation();
