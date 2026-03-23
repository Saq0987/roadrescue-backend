// controllers/providerController.js — Service Provider Management
const db = require('../config/db');

// GET /api/providers/nearby  — ML-ranked providers near location
exports.getNearby = async (req, res, next) => {
  try {
    const { lat, lng, service_type, radius = 20 } = req.query;
    if (!lat || !lng)
      return res.status(400).json({ success: false, message: 'lat and lng are required.' });

    const [rows] = await db.query(
      `SELECT sp.id, sp.business_name, sp.service_type, sp.avg_rating,
              sp.total_rescues, sp.ml_score, sp.is_available,
              u.first_name, u.last_name, u.phone,
              (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(sp.latitude))
              * COS(RADIANS(sp.longitude) - RADIANS(?))
              + SIN(RADIANS(?)) * SIN(RADIANS(sp.latitude)))) AS distance_km
       FROM service_providers sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.is_approved = 1 AND sp.is_available = 1
         ${service_type ? "AND (sp.service_type = ? OR sp.service_type = 'both')" : ''}
       HAVING distance_km < ?
       ORDER BY sp.ml_score DESC, distance_km ASC
       LIMIT 10`,
      service_type
        ? [lat, lng, lat, service_type, parseFloat(radius)]
        : [lat, lng, lat, parseFloat(radius)]
    );

    res.status(200).json({ success: true, count: rows.length, providers: rows });
  } catch (err) { next(err); }
};

// GET /api/providers/:id
exports.getProvider = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT sp.*, u.first_name, u.last_name, u.email, u.phone
       FROM service_providers sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.id = ?`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Provider not found.' });

    res.status(200).json({ success: true, provider: rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/providers/availability  — Toggle online/offline
exports.toggleAvailability = async (req, res, next) => {
  try {
    const { is_available, latitude, longitude } = req.body;
    await db.query(
      `UPDATE service_providers SET is_available = ?, latitude = ?, longitude = ?
       WHERE user_id = ?`,
      [is_available ? 1 : 0, latitude || null, longitude || null, req.user.id]
    );
    res.status(200).json({
      success: true,
      message: `You are now ${is_available ? 'online ✅' : 'offline 🔴'}.`,
    });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────────────────────
// controllers/reviewController.js — Reviews & NLP Sentiment
// ────────────────────────────────────────────────────────
const reviewController = {
  // POST /api/reviews
  create: async (req, res, next) => {
    try {
      const { request_id, rating, review_text } = req.body;

      // Verify request belongs to user and is completed
      const [reqRows] = await db.query(
        'SELECT * FROM service_requests WHERE id = ? AND customer_id = ? AND status = "completed"',
        [request_id, req.user.id]
      );
      if (!reqRows.length)
        return res.status(400).json({ success: false, message: 'Can only review completed requests.' });

      const request = reqRows[0];

      // Simple ML sentiment analysis (keyword-based)
      const sentiment = analyzeSentiment(review_text || '');

      await db.query(
        `INSERT INTO reviews (request_id, customer_id, provider_id, rating, review_text, sentiment_score, sentiment_label)
         VALUES (?,?,?,?,?,?,?)`,
        [request_id, req.user.id, request.provider_id, rating, review_text || null,
         sentiment.score, sentiment.label]
      );

      // Update provider avg_rating and ml_score
      await db.query(
        `UPDATE service_providers sp
         SET avg_rating = (SELECT AVG(r.rating) FROM reviews r WHERE r.provider_id = sp.id),
             ml_score   = LEAST(100, ml_score + ?)
         WHERE id = ?`,
        [rating >= 4 ? 2 : rating <= 2 ? -3 : 0, request.provider_id]
      );

      res.status(201).json({ success: true, message: 'Review submitted. Thank you!', sentiment });
    } catch (err) { next(err); }
  },

  // GET /api/reviews/provider/:id
  getForProvider: async (req, res, next) => {
    try {
      const [rows] = await db.query(
        `SELECT r.*, u.first_name, u.last_name
         FROM reviews r JOIN users u ON r.customer_id = u.id
         WHERE r.provider_id = ? ORDER BY r.created_at DESC`,
        [req.params.id]
      );
      res.status(200).json({ success: true, count: rows.length, reviews: rows });
    } catch (err) { next(err); }
  },
};

// Simple keyword sentiment (replace with real NLP model in production)
function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const pos = ['great','excellent','fast','good','amazing','helpful','perfect','awesome','fantastic'];
  const neg = ['bad','slow','terrible','awful','horrible','rude','late','unprofessional','worst'];
  let score = 0;
  pos.forEach(w => { if (lower.includes(w)) score += 0.2; });
  neg.forEach(w => { if (lower.includes(w)) score -= 0.2; });
  score = Math.max(-1, Math.min(1, score));
  const label = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
  return { score: parseFloat(score.toFixed(3)), label };
}

// ────────────────────────────────────────────────────────
// controllers/notificationController.js
// ────────────────────────────────────────────────────────
const notifController = {
  // GET /api/notifications
  getAll: async (req, res, next) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [req.user.id]
      );
      const unread = rows.filter(n => !n.is_read).length;
      res.status(200).json({ success: true, unread, notifications: rows });
    } catch (err) { next(err); }
  },

  // PATCH /api/notifications/read-all
  markAllRead: async (req, res, next) => {
    try {
      await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
      res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) { next(err); }
  },
};

module.exports = { providerController: exports, reviewController, notifController };