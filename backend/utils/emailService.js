const { Resend } = require('resend');

// Initialize Resend with API key from env
const resend = new Resend(process.env.RESEND_API_KEY);

// sendEmail — interface stays IDENTICAL to before
// Every controller calls this exact same way:
// sendEmail({ to, subject, html })
const sendEmail = async ({ to, subject, html }) => {
  try {
    // Validate inputs
    if (!to || !subject || !html) {
      console.error('[EMAIL] Missing required fields:', 
        { to, subject });
      return;
    }

    const { data, error } = await resend.emails.send({
      from: 'AttendX HR System <onboarding@resend.dev>',
      // ↑ Use this default sender until you verify
      //   your own domain on Resend dashboard
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return;
    }

    console.log('[EMAIL] Sent successfully:', data?.id);
    return data;

  } catch (err) {
    // NEVER crash server on email failure
    console.error('[EMAIL] Failed to send:', err.message);
  }
};

module.exports = { sendEmail };
