/**
 * emailService.js — Brevo (Sendinblue) HTTP API Email Service
 *
 * Why Brevo?
 *  - Render.com blocks SMTP (port 465/587) outbound connections.
 *  - Brevo's transactional API uses HTTPS (port 443) — works everywhere.
 *  - No OAuth2 complexity; single API key in .env.
 *
 * Setup:
 *  1. Sign up at https://app.brevo.com
 *  2. Go to SMTP & API → API Keys → Create a new key
 *  3. Add to .env:  BREVO_API_KEY=your_key_here
 *                   EMAIL_FROM=your_verified_sender@domain.com
 *                   EMAIL_FROM_NAME=AttendX HR System
 */

const https = require('https');

const BREVO_API_URL = 'api.brevo.com';
const BREVO_SEND_PATH = '/v3/smtp/email';

/**
 * sendEmail — Drop-in replacement for all existing { to, subject, html } calls.
 * @param {Object} options
 * @param {string} options.to        - Recipient email address
 * @param {string} options.subject   - Email subject line
 * @param {string} options.html      - HTML body content
 * @param {string} [options.text]    - Optional plain-text fallback
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!to || !subject || !html) {
      console.error('[EMAIL] Missing required fields: to, subject, or html');
      return;
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error('[EMAIL] BREVO_API_KEY is not set in .env');
      return;
    }

    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@attendx.com';
    const fromName  = process.env.EMAIL_FROM_NAME || 'AttendX HR System';

    const payload = JSON.stringify({
      sender:   { name: fromName, email: fromEmail },
      to:       [{ email: to }],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {})
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: BREVO_API_URL,
          path: BREVO_SEND_PATH,
          method: 'POST',
          headers: {
            'accept':       'application/json',
            'api-key':      apiKey,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[EMAIL] ✅ Sent via Brevo to ${to} | Subject: "${subject}"`);
              resolve({ messageId: JSON.parse(data)?.messageId, status: res.statusCode });
            } else {
              console.error(`[EMAIL] ❌ Brevo API error ${res.statusCode}:`, data);
              reject(new Error(`Brevo API returned ${res.statusCode}: ${data}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        console.error('[EMAIL] ❌ Network error sending email:', err.message);
        reject(err);
      });

      req.write(payload);
      req.end();
    });

    return result;

  } catch (err) {
    // Non-fatal: log the error but don't crash the calling function
    console.error('[EMAIL] Failed to send email:', err.message);
  }
};

module.exports = { sendEmail };
