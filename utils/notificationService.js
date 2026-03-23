// utils/notificationService.js
// Email (Nodemailer) + SMS (Twilio) Notification System

require('dotenv').config();
const nodemailer = require('nodemailer');
const db         = require('../config/db');

// ════════════════════════════════════════
//  EMAIL TRANSPORTER (Gmail / SMTP)
// ════════════════════════════════════════
const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || 'smtp.gmail.com',
  port:   process.env.MAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ── Email Templates ──
const emailTemplates = {
  welcome: (name) => ({
    subject: '🛣️ Welcome to RoadRescue!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0b0d;color:#e8eaf0;padding:2rem;border-radius:12px">
        <div style="font-size:2rem;font-weight:900;color:#f59e0b;letter-spacing:2px;margin-bottom:1rem">🛣️ ROADRESCUE</div>
        <h2 style="color:#e8eaf0">Welcome, ${name}! 🎉</h2>
        <p style="color:#9ca3af;line-height:1.7">Your account has been created successfully. Help is now always just a tap away.</p>
        <div style="background:#13151c;border:1px solid #232630;border-radius:8px;padding:1.2rem;margin:1.5rem 0">
          <p style="color:#f59e0b;font-weight:600;margin-bottom:0.5rem">What you can do:</p>
          <p style="color:#9ca3af">⛽ Request fuel delivery anywhere on the road</p>
          <p style="color:#9ca3af">🔧 Get a certified mechanic dispatched to you</p>
          <p style="color:#9ca3af">🤖 ML-powered smart matching & pricing</p>
        </div>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="display:inline-block;background:#f59e0b;color:#000;padding:0.8rem 2rem;border-radius:8px;text-decoration:none;font-weight:700">Open RoadRescue →</a>
        <p style="color:#4b5563;font-size:0.8rem;margin-top:2rem">© 2025 RoadRescue. All rights reserved.</p>
      </div>`,
  }),

  requestAccepted: (name, provider, eta) => ({
    subject: '✅ Your Request Has Been Accepted!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0b0d;color:#e8eaf0;padding:2rem;border-radius:12px">
        <div style="font-size:1.5rem;font-weight:900;color:#f59e0b;margin-bottom:1rem">🛣️ ROADRESCUE</div>
        <h2>Help is on the way, ${name}! 🚐</h2>
        <div style="background:#13151c;border:1px solid #22c55e;border-radius:8px;padding:1.2rem;margin:1.5rem 0">
          <p style="color:#22c55e;font-weight:600">✅ Request Accepted</p>
          <p style="color:#9ca3af;margin-top:0.5rem">Provider: <strong style="color:#e8eaf0">${provider}</strong></p>
          <p style="color:#9ca3af">Estimated Arrival: <strong style="color:#f59e0b">${eta} minutes</strong></p>
        </div>
        <p style="color:#9ca3af">Track your provider in real-time on the app.</p>
      </div>`,
  }),

  requestCompleted: (name, price) => ({
    subject: '🎉 Service Completed — Please Rate Your Experience',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0b0d;color:#e8eaf0;padding:2rem;border-radius:12px">
        <div style="font-size:1.5rem;font-weight:900;color:#f59e0b;margin-bottom:1rem">🛣️ ROADRESCUE</div>
        <h2>Service Completed! 🎉</h2>
        <p style="color:#9ca3af">Hi ${name}, your service has been completed successfully.</p>
        <div style="background:#13151c;border:1px solid #232630;border-radius:8px;padding:1.2rem;margin:1.5rem 0">
          <p style="color:#9ca3af">Total Charged: <strong style="color:#22c55e;font-size:1.2rem">₦${price}</strong></p>
        </div>
        <p style="color:#9ca3af">Please take a moment to rate your experience — your feedback helps us improve!</p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="display:inline-block;background:#f59e0b;color:#000;padding:0.8rem 2rem;border-radius:8px;text-decoration:none;font-weight:700">Rate Your Experience ⭐</a>
      </div>`,
  }),

  providerApproved: (name) => ({
    subject: '✅ Your Provider Account Has Been Approved!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0b0d;color:#e8eaf0;padding:2rem;border-radius:12px">
        <div style="font-size:1.5rem;font-weight:900;color:#f59e0b;margin-bottom:1rem">🛣️ ROADRESCUE</div>
        <h2>Congratulations, ${name}! ✅</h2>
        <p style="color:#9ca3af">Your service provider account has been approved. You can now go online and start receiving service requests.</p>
        <div style="background:#13151c;border:1px solid #22c55e;border-radius:8px;padding:1.2rem;margin:1.5rem 0">
          <p style="color:#22c55e;font-weight:600">You are now a verified RoadRescue provider</p>
          <p style="color:#9ca3af;margin-top:0.5rem">🤖 Our ML system will match you with nearby customers automatically</p>
          <p style="color:#9ca3af">💰 Payments are processed securely through the platform</p>
        </div>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="display:inline-block;background:#f59e0b;color:#000;padding:0.8rem 2rem;border-radius:8px;text-decoration:none;font-weight:700">Go Online Now →</a>
      </div>`,
  }),

  passwordReset: (name, resetUrl) => ({
    subject: '🔐 RoadRescue Password Reset',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0b0d;color:#e8eaf0;padding:2rem;border-radius:12px">
        <div style="font-size:1.5rem;font-weight:900;color:#f59e0b;margin-bottom:1rem">🛣️ ROADRESCUE</div>
        <h2>Password Reset Request</h2>
        <p style="color:#9ca3af">Hi ${name}, we received a request to reset your password.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#000;padding:0.8rem 2rem;border-radius:8px;text-decoration:none;font-weight:700;margin:1.5rem 0">Reset Password →</a>
        <p style="color:#4b5563;font-size:0.8rem">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>`,
  }),

  broadcast: (title, message) => ({
    subject: `📢 RoadRescue: ${title}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0b0d;color:#e8eaf0;padding:2rem;border-radius:12px">
        <div style="font-size:1.5rem;font-weight:900;color:#f59e0b;margin-bottom:1rem">🛣️ ROADRESCUE</div>
        <h2>${title}</h2>
        <p style="color:#9ca3af;line-height:1.7">${message}</p>
        <p style="color:#4b5563;font-size:0.8rem;margin-top:2rem">© 2025 RoadRescue</p>
      </div>`,
  }),
};

// ════════════════════════════════════════
//  SEND EMAIL
// ════════════════════════════════════════
async function sendEmail(to, templateName, ...args) {
  try {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.log(`[EMAIL] Skipped — MAIL_USER/PASS not configured. Would send "${templateName}" to ${to}`);
      return false;
    }
    const template = emailTemplates[templateName]?.(...args);
    if (!template) throw new Error(`Email template "${templateName}" not found`);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'RoadRescue <no-reply@roadrescue.com>',
      to,
      subject: template.subject,
      html:    template.html,
    });
    console.log(`[EMAIL] ✅ Sent "${templateName}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] ❌ Failed to send to ${to}:`, err.message);
    return false;
  }
}

// ════════════════════════════════════════
//  SEND SMS (Twilio — optional)
//  Install: npm install twilio
//  Add to .env: TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM
// ════════════════════════════════════════
async function sendSMS(to, message) {
  try {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
      console.log(`[SMS] Skipped — Twilio not configured. Would send to ${to}: "${message}"`);
      return false;
    }
    // Lazy-load twilio only if configured
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await client.messages.create({
      body: `🛣️ RoadRescue: ${message}`,
      from: process.env.TWILIO_FROM,
      to,
    });
    console.log(`[SMS] ✅ Sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`[SMS] ❌ Failed to send to ${to}:`, err.message);
    return false;
  }
}

// ════════════════════════════════════════
//  SAVE TO DB + SEND (combined)
// ════════════════════════════════════════
async function notify(userId, title, message, type = 'alert', channels = ['db']) {
  try {
    // Always save to DB notifications table
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
      [userId, title, message, type]
    );

    // Fetch user contact info if email/SMS needed
    if (channels.includes('email') || channels.includes('sms')) {
      const [rows] = await db.query('SELECT first_name, email, phone FROM users WHERE id = ?', [userId]);
      if (rows.length) {
        const user = rows[0];
        if (channels.includes('email')) {
          await sendEmail(user.email, 'broadcast', title, message);
        }
        if (channels.includes('sms') && user.phone) {
          await sendSMS(user.phone, `${title}: ${message}`);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[NOTIFY] Error:', err.message);
    return false;
  }
}

// ════════════════════════════════════════
//  BROADCAST TO ALL USERS
// ════════════════════════════════════════
async function broadcastToAll(title, message, role = null) {
  try {
    const query = role
      ? 'SELECT id, first_name, email, phone FROM users WHERE is_active = 1 AND role = ?'
      : 'SELECT id, first_name, email, phone FROM users WHERE is_active = 1';
    const params = role ? [role] : [];
    const [users] = await db.query(query, params);

    let sent = 0;
    for (const user of users) {
      await db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
        [user.id, title, message, 'alert']
      );
      // Email — throttle to avoid rate limiting
      if (process.env.MAIL_USER) {
        await sendEmail(user.email, 'broadcast', title, message);
        await new Promise(r => setTimeout(r, 100)); // 100ms delay between emails
      }
      sent++;
    }
    console.log(`[BROADCAST] ✅ Sent to ${sent} users`);
    return { sent };
  } catch (err) {
    console.error('[BROADCAST] Error:', err.message);
    throw err;
  }
}

// ════════════════════════════════════════
//  CONVENIENCE WRAPPERS
// ════════════════════════════════════════
const notifications = {
  // Called when user registers
  async onRegister(userId, firstName, email) {
    await sendEmail(email, 'welcome', firstName);
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
      [userId, 'Welcome to RoadRescue! 🎉', 'Your account has been created. Help is always near.', 'alert']
    );
  },

  // Called when provider accepts a request
  async onRequestAccepted(customerId, customerEmail, customerPhone, providerName, eta) {
    const msg = `Your request has been accepted by ${providerName}. ETA: ${eta} minutes.`;
    await sendEmail(customerEmail, 'requestAccepted', customerEmail.split('@')[0], providerName, eta);
    await sendSMS(customerPhone, msg);
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
      [customerId, '🚐 Provider En Route!', msg, 'status']
    );
  },

  // Called when service is completed
  async onRequestCompleted(customerId, customerEmail, customerName, finalPrice) {
    await sendEmail(customerEmail, 'requestCompleted', customerName, finalPrice);
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
      [customerId, '✅ Service Completed!', `Your service has been completed. Total: ₦${finalPrice}. Please rate your experience.`, 'status']
    );
  },

  // Called when admin approves a provider
  async onProviderApproved(providerId, providerEmail, providerName) {
    await sendEmail(providerEmail, 'providerApproved', providerName);
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
      [providerId, '✅ Account Approved!', 'Your provider account has been approved. You can now go online and receive requests.', 'alert']
    );
  },

  // ML insight notification
  async onMLInsight(userId, insight) {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
      [userId, '🤖 ML Insight', insight, 'ml_insight']
    );
  },
};

module.exports = { sendEmail, sendSMS, notify, broadcastToAll, notifications };