/**
 * @desc    Collection of HTML email templates with inline CSS
 *          Max-width: 600px, mobile-responsive, consistent AttendX branding
 */

// Shared Styles for Buttons
const buttonStyle = `
  background-color: #6366f1;
  color: #ffffff;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  display: inline-block;
  margin-top: 20px;
`;

const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .highlight { color: #4f46e5; font-weight: bold; }
        .info-box { background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #6366f1; }
        .button { ${buttonStyle} }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0; color: #ffffff;">AttendX HRMS</h1>
            <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">The Ultimate Workforce Hub</p>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX HRMS. All rights reserved.</p>
            <p>This is an automated notification, please do not reply.</p>
        </div>
    </div>
</body>
</html>
`;

// 1. Welcome Email (Admin -> Employee)
const welcomeEmployeeTemplate = ({ employeeName, email, password }) => emailWrapper(`
    <h2>Welcome to the Team, ${employeeName}! 🎊</h2>
    <p>We're thrilled to have you onboard. Your account has been created successfully.</p>
    <div class="info-box">
        <p><strong>Login Email:</strong> ${email}<br>
        <strong>Temporary Password:</strong> ${password}</p>
    </div>
    <p>Please login and update your password immediately after your first sign-in for security.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/login" class="button">Login to Portal</a>
    </div>
`);

// 2. Password Reset Token
const passwordResetTemplate = ({ employeeName, resetUrl }) => emailWrapper(`
    <h2>Password Reset Request</h2>
    <p>Hello ${employeeName},</p>
    <p>We received a request to reset your password. If you didn't make this request, please ignore this email.</p>
    <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <p style="margin-top:20px; font-size:12px; color:#666; text-align: center;">This link is valid for only 15 minutes.</p>
`);

// 3. Leave Request Alert (Employee -> Admin)
const leaveRequestAdminTemplate = ({ employeeName, leaveType, startDate, endDate, reason, totalDays }) => emailWrapper(`
    <h2>🔔 New Leave Request Received</h2>
    <p>A new leave request has been submitted by <strong>${employeeName}</strong>. Here are the details:</p>
    <div class="info-box">
        <p><strong>Type:</strong> ${leaveType}<br>
        <strong>Duration:</strong> ${startDate} to ${endDate} (${totalDays} day/s)<br>
        <strong>Reason:</strong> ${reason}</p>
    </div>
    <p>Please review the request in the admin dashboard.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/login" class="button">Review Request Now</a>
    </div>
`);

// 4. Leave Approved (Admin -> Employee)
const leaveApprovedTemplate = ({ employeeName, leaveType, startDate, endDate, adminComment }) => emailWrapper(`
    <h2 style="color: #059669;">✅ Leave Approved!</h2>
    <p>Hello ${employeeName},</p>
    <p>Good news! Your request for <span class="highlight">${leaveType}</span> from <strong>${startDate} to ${endDate}</strong> has been approved.</p>
    ${adminComment ? `<div class="info-box"><p><strong>Admin Note:</strong> ${adminComment}</p></div>` : ''}
    <p>Enjoy your time off!</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/leaves" class="button" style="background-color: #059669;">View My Dashboard</a>
    </div>
`);

// 5. Leave Rejected (Admin -> Employee)
const leaveRejectedTemplate = ({ employeeName, leaveType, startDate, endDate, adminComment }) => emailWrapper(`
    <h2 style="color: #dc2626;">❌ Leave Request Not Approved</h2>
    <p>Hello ${employeeName},</p>
    <p>Your request for <span class="highlight">${leaveType}</span> from <strong>${startDate} to ${endDate}</strong> could not be approved at this time.</p>
    <div class="info-box" style="border-left-color: #dc2626;">
        <p><strong>Reason:</strong> ${adminComment ? adminComment : 'No specific reason provided.'}</p>
    </div>
    <p>If you have questions, please reach out to your manager.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/leaves" class="button" style="background-color: #dc2626;">Check My Requests</a>
    </div>
`);

// 6. Late Arrival Alert (System -> Employee)
const lateArrivalTemplate = ({ employeeName, checkInTime, officeStartTime, minutesLate }) => emailWrapper(`
    <h2 style="color: #b91c1c;">⏰ Late Arrival Logged</h2>
    <p>Hello ${employeeName},</p>
    <p>The system has recorded a late check-in for your shift today.</p>
    <div class="info-box" style="border-left-color: #b91c1c;">
        <p><strong>Actual Check-in:</strong> ${checkInTime}<br>
        <strong>Office Threshold:</strong> ${officeStartTime}<br>
        <strong>Delay:</strong> ${minutesLate} minutes</p>
    </div>
    <p>Please strive for punctuality to maintain a high professional standard.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/dashboard" class="button" style="background-color: #b91c1c;">View Attendance Log</a>
    </div>
`);

// 7. General Broadcast/Notice (Admin -> Everyone)
const broadcastNoticeTemplate = ({ employeeName, noticeTitle, noticeContent, postedBy, postedAt }) => emailWrapper(`
    <h2>📢 New Company Announcement</h2>
    <p>Hello ${employeeName},</p>
    <p><strong>${postedBy}</strong> has posted a new notice: <span class="highlight">${noticeTitle}</span></p>
    <div class="info-box">
        <p style="white-space: pre-line;">${noticeContent}</p>
    </div>
    <p style="font-size:12px; color:#666;">Date: ${postedAt}</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/notices" class="button">Open Notice Board</a>
    </div>
`);

// 8. Policy/Settings Update (Admin -> Everyone)
const policyChangeTemplate = ({ employeeName, changeType, oldValue, newValue, effectiveFrom, updatedBy }) => emailWrapper(`
    <h2>⚖️ Office Policy Updated</h2>
    <p>Hello ${employeeName},</p>
    <p>Please note that the <span class="highlight">${changeType}</span> has been updated by management.</p>
    <div class="info-box">
        <table style="width: 100%; font-size: 14px;">
            <tr><td style="color: #666; width: 40%;">Previous:</td><td>${oldValue}</td></tr>
            <tr><td style="color: #666;">New Policy:</td><td style="font-weight: bold; color: #4f46e5;">${newValue}</td></tr>
            <tr><td style="color: #666;">Effective:</td><td>${effectiveFrom}</td></tr>
        </table>
    </div>
    <p>These changes apply to all relevant shifts moving forward.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/dashboard" class="button">View Modern Policy</a>
    </div>
`);

// 9. Payslip Ready (Admin -> Employee)
const payslipTemplate = ({ employeeName, month, year, basicSalary, deductions, bonuses, netSalary, presentDays, absentDays, lateDays }) => emailWrapper(`
    <h2>💰 Your Payslip for ${month} ${year}</h2>
    <p>Hello ${employeeName}, your salary has been processed for the recent month.</p>
    <div class="info-box" style="background-color: #f0fdf4; border-left-color: #059669;">
        <p style="margin: 0; font-size: 24px; color: #059669; font-weight: bold;">₹${netSalary.toLocaleString('en-IN')}</p>
        <p style="margin: 4px 0 0; font-size: 14px; color: #065f46;">Net Payable Salary</p>
    </div>
    <table style="width: 100%; font-size: 13px; margin-top: 15px; color: #666;">
        <tr><td>Present: ${presentDays}</td><td>Absent: ${absentDays}</td><td>Late: ${lateDays}</td></tr>
    </table>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/dashboard" class="button" style="background-color: #059669;">Download Payslip</a>
    </div>
`);

// 10. Auto-Checkout Reminder (Cron -> Employee)
const checkoutReminderTemplate = ({ employeeName, todayDate }) => emailWrapper(`
    <h2 style="color: #d97706;">⚠️ Action Required: Missing Checkout</h2>
    <p>Hello ${employeeName},</p>
    <p>Our system detected that you are still checked in for <strong>${todayDate}</strong>.</p>
    <p>To ensure your working hours and payroll are calculated accurately, please log back in and checkout now.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/dashboard" class="button" style="background-color: #d97706;">Complete Checkout Now</a>
    </div>
`);

// 11. Profile Updated (Admin -> Employee)
const profileUpdatedByAdminTemplate = ({ employeeName, updatedFields }) => emailWrapper(`
    <h2>👤 Profile Updated</h2>
    <p>Hello ${employeeName},</p>
    <p>Your profile information has been updated by the HR department.</p>
    <div class="info-box">
        <p><strong>Updated Fields:</strong> ${updatedFields.join(', ')}</p>
    </div>
    <p>Please log in to your portal to review the changes.</p>
    <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/profile" class="button">View My Profile</a>
    </div>
`);

module.exports = {
    welcomeEmployeeTemplate,
    passwordResetTemplate,
    leaveRequestAdminTemplate,
    leaveApprovedTemplate,
    leaveRejectedTemplate,
    lateArrivalTemplate,
    broadcastNoticeTemplate,
    policyChangeTemplate,
    payslipTemplate,
    checkoutReminderTemplate,
    profileUpdatedByAdminTemplate
};
