const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');

// Mock settings
const settings = {
    halfDayThreshold: 5, // 300 minutes (Full day)
    officeStartTime: '09:15',
    lateGracePeriod: 0
};

const auditEdgeCases = () => {
    console.log('--- SECTION 4: EDGE CASE VALIDATION ---');
    
    const cases = [
        { 
            name: '1. 3h 59m (239m), no leave', 
            work: 239, 
            meta: { cl: 0, sl: 0, rl: 0, lwp: 0 },
            expectedStatus: 'half-day', 
            expectedFraction: 0.5 
        },
        { 
            name: '2. 4h (240m) + 0.5 LWP', 
            work: 240, 
            meta: { cl: 0, sl: 0, rl: 0, lwp: 0.5 },
            expectedStatus: 'half-day', 
            expectedFraction: 0.5 
        },
        { 
            name: '3. 4h (240m) + 0.5 CL', 
            work: 240, 
            meta: { cl: 0.5, sl: 0, rl: 0, lwp: 0 },
            expectedStatus: 'present', 
            expectedFraction: 0.5 
        },
        { 
            name: '4. 5h exact (300m)', 
            work: 300, 
            meta: { cl: 0, sl: 0, rl: 0, lwp: 0 },
            expectedStatus: 'present', 
            expectedFraction: 1.0 
        },
        { 
            name: '5. 0h + 1 LWP', 
            work: 0, 
            meta: { cl: 0, sl: 0, rl: 0, lwp: 1.0 },
            expectedStatus: 'absent', 
            expectedFraction: 0 
        }
    ];

    cases.forEach(tc => {
        const record = new Attendance({
            date: '2026-05-01',
            checkIn: new Date('2026-05-01T09:15:00Z'),
            checkOut: new Date(),
            leaveMeta: tc.meta,
            totalBreakTime: 0
        });
        
        record.calculateWorkingHours = () => tc.work;

        const result = record.determineStatus(settings);
        
        // Simulating the pre-save logic for Paid Calculation (as payroll would see it)
        const paidDays = (result.workFraction) + (tc.meta.cl || 0) + (tc.meta.sl || 0) + (tc.meta.rl || 0);
        
        const success = result.status === tc.expectedStatus && result.workFraction === tc.expectedFraction;
        
        console.log(`Test: ${tc.name}`);
        console.log(`   Result:   Status=${result.status}, Fraction=${result.workFraction}, Payable=${paidDays}`);
        console.log(`   Expected: Status=${tc.expectedStatus}, Fraction=${tc.expectedFraction}`);
        console.log(`   Success:  ${success ? '✅' : '❌'}`);
    });
};

auditEdgeCases();
