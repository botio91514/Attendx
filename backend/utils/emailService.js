const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  const accessToken = await new Promise((resolve, reject) => {
    oauth2Client.getAccessToken((err, token) => {
      if (err) {
        console.error('[EMAIL] Failed to get access token:', err);
        reject(err);
      }
      resolve(token);
    });
  });

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      accessToken,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
};

const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!to || !subject || !html) {
      console.error('[EMAIL] Missing required fields');
      return;
    }

    const transporter = await createTransporter();

    const result = await transporter.sendMail({
      from: `"AttendX HR System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log('[EMAIL] Sent successfully:', result.messageId);
    return result;

  } catch (err) {
    console.error('[EMAIL] Failed to send:', err.message);
  }
};

module.exports = { sendEmail };
