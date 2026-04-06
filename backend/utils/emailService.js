const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 as primary for internal Node networking to solve ENETUNREACH issues with IPv6
dns.setDefaultResultOrder('ipv4first');

/**
 * @desc    Single reusable function to send emails via SMTP
 * @param   {Object} options - { to, subject, html }
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"AttendX HR System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    // ⚠️ CRITICAL RULE: NEVER crash the server on email failure
    console.error('Email failed to send:', error);
    return null;
  }
};

module.exports = { sendEmail };
