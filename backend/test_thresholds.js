const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');

// Mock settings
const settings = {
    halfDayThreshold: 5, // 300 minutes
    officeStartTime: '09:15',
    lateGracePeriod: 0
};

const runTests = () => {
    console.log('--- STARTING ATTENDANCE THRESHOLD VALIDATION ---');
    
    const testCases = [
        { name: '10 min', workedMinutes: 10, expectedStatus: 'absent', expectedFraction: 0 },
        { name: '3h 59m (239 min)', workedMinutes: 239, expectedStatus: 'half-day', expectedFraction: 0.5 },
        { name: '4h 30m (270 min)', workedMinutes: 270, expectedStatus: 'half-day', expectedFraction: 0.5 },
        { name: '5h 00m (300 min)', workedMinutes: 300, expectedStatus: 'present', expectedFraction: 1.0 },
        { name: '8h (480 min)', workedMinutes: 480, expectedStatus: 'present', expectedFraction: 1.0 }
    ];

    testCases.forEach(tc => {
        // Create a mock record
        const record = new Attendance({
            date: '2026-05-01',
            checkIn: new Date('2026-05-01T09:15:00Z'),
            // We mock calculateWorkingHours by overriding it for the test
            totalBreakTime: 0
        });
        
        record.calculateWorkingHours = () => tc.workedMinutes;
        record.checkOut = new Date(); // Just to trigger the checkOut logic

        const result = record.determineStatus(settings);
        
        const success = result.status === tc.expectedStatus && result.workFraction === tc.expectedFraction;
        
        console.log(`Test: ${tc.name}`);
        console.log(`   Result: Status=${result.status}, Fraction=${result.workFraction}`);
        console.log(`   Expected: Status=${tc.expectedStatus}, Fraction=${tc.expectedFraction}`);
        console.log(`   Success: ${success ? '✅' : '❌'}`);
    });
};

runTests();
