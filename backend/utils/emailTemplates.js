/**
 * @desc    Premium AttendX HRMS Email Templates
 *          Polished LIGHT theme with soft shadows, refined gradients, and modern typography
 *          Max-width: 650px, fully mobile-responsive
 */

// ─────────────────────────────────────────────
// SHARED BASE WRAPPER — Light Premium Theme
// ─────────────────────────────────────────────
const emailWrapper = (content, accentColor = '#6366f1') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AttendX HRMS</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    @media only screen and (max-width: 600px) {
      .inner-container { padding: 30px 20px !important; }
      .header { padding: 30px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:40px 10px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">

        <!-- ══ HEADER ══ -->
        <tr>
          <td style="
            background: #ffffff;
            padding: 40px 48px 0;
            text-align: center;
          ">
            <!-- Logo Badge (Simplified for visibility) -->
            <div style="display:inline-block;background-color:${accentColor};border-radius:14px;padding:14px 28px;margin-bottom:16px;">
              <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">AttendX</span>
            </div>
            <p style="margin:0;color:#64748b;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Workforce Intelligence Pro</p>
          </td>
        </tr>

        <!-- ══ CONTENT BODY ══ -->
        <tr>
          <td class="inner-container" style="padding: 40px 48px;">
            ${content}
          </td>
        </tr>

        <!-- ══ FOOTER ══ -->
        <tr>
          <td style="
            background-color: #f1f5f9;
            padding: 24px 48px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          ">
            <p style="margin:0 0 4px;color:#64748b;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">AttendX HRMS · Intelligence Platform</p>
            <p style="margin:0;color:#94a3b8;font-size:10px;">Automated notification — do not reply to this email.</p>
            <div style="margin-top:12px;height:1px;background-color:#e2e8f0;width:60px;display:inline-block;"></div>
            <p style="margin:12px 0 0;color:#cbd5e1;font-size:10px;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
`;

// ─────────────────────────────────────────────
// SHARED COMPONENTS (Light Theme)
// ─────────────────────────────────────────────

const premiumButton = (text, url, color = '#6366f1') => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
    <tr><td align="center">
      <a href="${url}" style="
        display:inline-block;
        background:${color};
        color:#ffffff;
        font-family:'Inter',sans-serif;
        font-size:14px;
        font-weight:700;
        letter-spacing:0.5px;
        text-decoration:none;
        padding:16px 36px;
        border-radius:12px;
        box-shadow: 0 10px 15px -3px rgba(99,102,241,0.3);
      ">${text} &nbsp;→</a>
    </td></tr>
  </table>
`;

const infoCard = (rows, borderColor = '#6366f1') => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
    background:#ffffff;
    border-radius:16px;
    border:1px solid #f1f5f9;
    margin:24px 0;
    overflow:hidden;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
  ">
    ${rows.map((row, i) => `
    <tr style="border-bottom:${i < rows.length - 1 ? '1px solid #f8fafc' : 'none'};">
      <td style="padding:16px 20px;color:#64748b;font-size:13px;font-weight:500;white-space:nowrap;width:35%;">${row.label}</td>
      <td style="padding:16px 20px;color:#1e293b;font-size:13px;font-weight:600;">${row.value}</td>
    </tr>`).join('')}
  </table>
`;

const statusBadge = (text, color) => `
  <span style="
    display:inline-block;
    background-color:#f1f5f9;
    color:${color};
    border-radius:6px;
    padding:6px 12px;
    font-size:11px;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:0.5px;
    border: 1px solid #e2e8f0;
  ">${text}</span>
`;

// Helper for live links
const getLiveUrl = (path = '') => {
  const base = (process.env.CLIENT_URL || 'https://gatistwamhrms.netlify.app').split(',')[0].trim();
  return `${base}${path}`;
};

// ─────────────────────────────────────────────
// 1. WELCOME EMAIL (Admin → Employee)
// ─────────────────────────────────────────────
const welcomeEmployeeTemplate = ({ employeeName, email, password }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;line-height:1.2;text-align:center;">Welcome to the Team, <span style="color:#6366f1;">${employeeName}!</span></h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">We're thrilled to have you onboard. Your AttendX account is ready for use. Please find your credentials below.</p>

  ${infoCard([
    { label: '📧 Login Email', value: email },
    { label: '🔐 Temp Password', value: `<code style="background:#f1f5f9;padding:4px 8px;border-radius:6px;font-family:monospace;color:#6366f1;font-weight:bold;">${password}</code>` }
  ])}

  <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:12px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">⚠️ Important: Change your password immediately after your first sign-in for security.</p>
  </div>

  ${premiumButton('Securely Login Now', getLiveUrl('/login'), '#6366f1')}
`, '#6366f1');

// ─────────────────────────────────────────────
// 2. PASSWORD RESET
// ─────────────────────────────────────────────
const passwordResetTemplate = ({ employeeName, resetUrl }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;text-align:center;">Password Reset</h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">Hello <strong>${employeeName}</strong>, we received a request to reset your password. If you didn't request this, ignore this email.</p>

  <div style="background:#f1f5f9;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
    <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Link Expires In</p>
    <p style="margin:0;font-size:28px;font-weight:800;color:#6366f1;">15 Minutes</p>
  </div>

  ${premiumButton('Reset My Password', resetUrl, '#6366f1')}
`, '#6366f1');

// ─────────────────────────────────────────────
// 3. LEAVE REQUEST ALERT (Employee → Admin)
// ─────────────────────────────────────────────
const leaveRequestAdminTemplate = ({ employeeName, leaveType, startDate, endDate, reason, totalDays }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;line-height:1.2;">New Request <span style="color:#f59e0b;">Pending</span></h1>
  <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;"><strong>${employeeName}</strong> has submitted a new leave application for your review.</p>

  ${infoCard([
    { label: '👤 Employee', value: employeeName },
    { label: '📋 Leave Type', value: leaveType },
    { label: '🗓️ Duration', value: `<strong>${totalDays} day${totalDays > 1 ? 's' : ''}</strong>` },
    { label: '📅 Timeline', value: `${startDate} to ${endDate}` },
    { label: '💬 Reason', value: reason }
  ], '#f59e0b')}

  ${premiumButton('Review in Admin Dashboard', getLiveUrl('/admin/leaves'), '#f59e0b')}
`, '#f59e0b');

// ─────────────────────────────────────────────
// 4. LEAVE APPROVED (Admin → Employee)
// ─────────────────────────────────────────────
const leaveApprovedTemplate = ({ employeeName, leaveType, startDate, endDate, adminComment }) => emailWrapper(`
  <div style="text-align:center;margin-bottom:24px;">
    <span style="display:inline-block;background:#ecfdf5;border:1px solid #d1fae5;width:60px;height:60px;border-radius:30px;line-height:60px;font-size:24px;">🎉</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;text-align:center;">Leave <span style="color:#10b981;">Approved!</span></h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">Good news, <strong>${employeeName}</strong>! Your request for time off has been approved.</p>

  ${infoCard([
    { label: '📋 Leave Type', value: leaveType },
    { label: '📅 Period', value: `${startDate} to ${endDate}` },
    { label: '📊 Status', value: statusBadge('Approved', '#10b981') },
    ...(adminComment ? [{ label: '💬 Admin Note', value: adminComment }] : [])
  ], '#10b981')}

  ${premiumButton('View My Dashboard', getLiveUrl('/dashboard'), '#10b981')}
`, '#10b981');

// ─────────────────────────────────────────────
// 5. LEAVE REJECTED (Admin → Employee)
// ─────────────────────────────────────────────
const leaveRejectedTemplate = ({ employeeName, leaveType, startDate, endDate, adminComment }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;text-align:center;">Leave Not Approved</h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">Hello <strong>${employeeName}</strong>, your leave request for ${startDate} to ${endDate} could not be approved at this time.</p>

  ${infoCard([
    { label: '📋 Application', value: leaveType },
    { label: '📊 Status', value: statusBadge('Not Approved', '#ef4444') },
    { label: '💬 Manager Note', value: `<em>${adminComment || 'No specific reason provided.'}</em>` }
  ], '#ef4444')}

  <p style="margin:16px 0 0;color:#94a3b8;font-size:14px;text-align:center;">Please contact your HR manager if you need further clarification.</p>
`, '#ef4444');

// ─────────────────────────────────────────────
// 6. LATE ARRIVAL ALERT (System → Employee)
// ─────────────────────────────────────────────
const lateArrivalTemplate = ({ employeeName, checkInTime, officeStartTime, minutesLate }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;">Attendance <span style="color:#f97316;">Log</span></h1>
  <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;">Hello <strong>${employeeName}</strong>, the system has recorded a late check-in for your shift today.</p>

  ${infoCard([
    { label: '⏰ Expected Time', value: officeStartTime },
    { label: '🕐 Actual Check-in', value: `<span style="color:#ef4444;font-weight:bold;">${checkInTime}</span>` },
    { label: '⏱️ Delay Measured', value: `<span style="color:#ef4444;font-weight:bold;">${minutesLate} minutes</span>` }
  ], '#f97316')}

  <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:12px;padding:16px 20px;">
    <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.6;">Punctuality helps us maintain smooth operations. Please ensure timely arrival for future shifts.</p>
  </div>

  ${premiumButton('Review My Attendance', getLiveUrl('/dashboard'), '#f97316')}
`, '#f97316');

// ─────────────────────────────────────────────
// 9. PAYSLIP READY (Admin → Employee)
// ─────────────────────────────────────────────
const payslipTemplate = ({ employeeName, month, year, basicSalary, deductions, bonuses, netSalary, presentDays, absentDays, lateDays }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;">Salary <span style="color:#10b981;">Processed</span></h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;">Hello <strong>${employeeName}</strong>, your salary for <strong>${month} ${year}</strong> has been successfully credited.</p>

  <!-- Net Salary Feature (Simplified Colors) -->
  <div style="background-color:#f0fdf4;border:2px solid #bbf7d0;border-radius:24px;padding:32px;text-align:center;margin:24px 0;">
    <p style="margin:0 0 4px;color:#166534;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Net Payable Salary</p>
    <p style="margin:0;font-size:42px;font-weight:900;color:#15803d;letter-spacing:-1px;">₹${netSalary.toLocaleString('en-IN')}</p>
  </div>

  ${infoCard([
    { label: '💵 Basic Pay', value: `₹${basicSalary.toLocaleString('en-IN')}` },
    { label: '🎁 Total Bonuses', value: `<span style="color:#10b981;">+₹${bonuses.toLocaleString('en-IN')}</span>` },
    { label: '📉 Total Deductions', value: `<span style="color:#dc2626;">-₹${deductions.toLocaleString('en-IN')}</span>` },
    { label: '✅ Days Tracked', value: `${presentDays} Present / ${absentDays} Absent` }
  ], '#10b981')}

  ${premiumButton('Download Full Payslip', getLiveUrl('/dashboard'), '#10b981')}
`, '#10b981');

// ─────────────────────────────────────────────
// 10. CHECKOUT REMINDER
// ─────────────────────────────────────────────
const checkoutReminderTemplate = ({ employeeName, checkInTime, todayDate, currentTime }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;">Missing <span style="color:#f59e0b;">Checkout</span></h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;">Hello <strong>${employeeName}</strong>, our tracking system detected that you are still marked as "Checked In" for today.</p>

  ${infoCard([
    { label: '📅 Date', value: todayDate },
    { label: '🟢 Check-in Logged', value: checkInTime },
    { label: '🕐 Reminder Time', value: currentTime },
    { label: '📊 Status', value: statusBadge('Pending', '#f59e0b') }
  ], '#f59e0b')}

  <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:12px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0;color:#92400e;font-size:13px;font-weight:500;">⚡ Please checkout now to ensure your working hours are accurately captured for payroll.</p>
  </div>

  ${premiumButton('Complete Checkout Now', getLiveUrl('/dashboard'), '#f59e0b')}
`, '#f59e0b');

// ─────────────────────────────────────────────
// 11. ABSENT ALERT (SYSTEM → Employee who missed check-in)
// ─────────────────────────────────────────────
const absentAlertTemplate = ({ employeeName, todayDate, officeStartTime, gracePeriodMinutes, deadlineTime }) => emailWrapper(`
  <div style="text-align:center;margin-bottom:24px;">
    <span style="display:inline-block;background:#fef2f2;border:1px solid #fee2e2;width:60px;height:60px;border-radius:30px;line-height:60px;font-size:24px;">🔔</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;text-align:center;">Unmarked <span style="color:#ef4444;">Attendance</span></h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">Hello <strong>${employeeName}</strong>, we noticed you haven't checked in yet today. The grace period for arrival has passed.</p>

  ${infoCard([
    { label: '📅 Date Tracked', value: todayDate },
    { label: '🏢 Office Start', value: officeStartTime },
    { label: '⏳ Grace Provided', value: `${gracePeriodMinutes} mins` },
    { label: '🕒 Reporting Cutoff', value: deadlineTime },
    { label: '📊 Current Status', value: statusBadge('Marked Absent', '#ef4444') }
  ], '#ef4444')}

  <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.6;">If you are unable to report for work, please apply for leave immediately through the portal.</p>
  </div>

  ${premiumButton('Go to My Portal', getLiveUrl('/dashboard'), '#ef4444')}
`, '#ef4444');

// ─────────────────────────────────────────────
// 12. GENERAL ANNOUNCEMENT
// ─────────────────────────────────────────────
const broadcastNoticeTemplate = ({ employeeName, noticeTitle, noticeContent, postedBy, postedAt }) => emailWrapper(`
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;">New <span style="color:#6366f1;">Announcement</span></h1>
  <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;">Hello <strong>${employeeName}</strong>, a new company-wide update has been posted.</p>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin:20px 0;">
    <h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">${noticeTitle}</h3>
    <p style="margin:0;color:#64748b;font-size:14px;line-height:1.8;white-space:pre-line;">${noticeContent}</p>
  </div>

  ${infoCard([
    { label: '👤 From', value: postedBy },
    { label: '📅 Dated', value: postedAt }
  ])}

  ${premiumButton('View All Announcements', getLiveUrl('/notices'), '#6366f1')}
`, '#6366f1');

// ─────────────────────────────────────────────
module.exports = {
  welcomeEmployeeTemplate,
  passwordResetTemplate,
  leaveRequestAdminTemplate,
  leaveApprovedTemplate,
  leaveRejectedTemplate,
  lateArrivalTemplate,
  payslipTemplate,
  checkoutReminderTemplate,
  absentAlertTemplate,
  broadcastNoticeTemplate,
  // Mapping other templates to shared wrapper logic if needed
  policyChangeTemplate: (data) => broadcastNoticeTemplate({...data, noticeTitle: 'Policy Update: ' + data.changeType, noticeContent: `Previous: ${data.oldValue}\nNew Policy: ${data.newValue}\nEffective From: ${data.effectiveFrom}`}),
  profileUpdatedByAdminTemplate: (data) => broadcastNoticeTemplate({...data, noticeTitle: 'Profile Information Updated', noticeContent: `The following profile fields were updated by the HR department: ${data.updatedFields.join(', ')}`}),
  breakExceededTemplate: ({ employeeName, breakStartTime, allowedMinutes, elapsedMinutes }) => emailWrapper(`
  <div style="text-align:center;margin-bottom:24px;">
    <span style="display:inline-block;background:#fef2f2;border:1px solid #fee2e2;width:60px;height:60px;border-radius:30px;line-height:60px;font-size:24px;">⛔</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;text-align:center;">Break Time <span style="color:#ef4444;">Exceeded</span></h1>
  <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">Hello <strong>${employeeName}</strong>, our tracking system has detected that you have exceeded the allowed break duration for today.</p>

  ${infoCard([
    { label: '🕒 Break Started', value: breakStartTime },
    { label: '⏳ Permitted Duration', value: `${allowedMinutes} minutes` },
    { label: '⏱️ Current Duration', value: `<span style="color:#ef4444;font-weight:bold;">${elapsedMinutes} minutes</span>` },
    { label: '📊 Status', value: statusBadge('Exceeded Policy', '#ef4444') }
  ], '#ef4444')}

  <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.6;font-weight:600;">⚡ Action Required: Please return to your workstation and end your break in the AttendX portal immediately.</p>
  </div>

  ${premiumButton('Return to Dashboard', getLiveUrl('/dashboard'), '#ef4444')}
`, '#ef4444'),
};
