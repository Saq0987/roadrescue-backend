// controllers/requestController.js — Service Requests CRUD
const db = require('../config/db');
const { validationResult } = require('express-validator');
const { mlEstimate } = require('../utils/mlUtils');

// ────────────────────────────────────────
// POST /api/requests  — Create new request
// ────────────────────────────────────────
exports.createRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const {
      service_type, latitude, longitude, address,
      fuel_type, fuel_quantity,
      problem_type, problem_notes,
      vehicle_id, payment_method,
    } = req.body;

    // Get ML estimate
    const ml = mlEstimate({ latitude, longitude, service_type, fuel_quantity });

    const [result] = await db.query(
      `INSERT INTO service_requests
        (customer_id, vehicle_id, service_type, latitude, longitude, address,
         fuel_type, fuel_quantity, problem_type, problem_notes,
         estimated_price, payment_method,
         ml_eta_minutes, ml_demand_level, ml_confidence, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
      [
        req.user.id, vehicle_id || null, service_type,
        latitude, longitude, address || null,
        fuel_type || null, fuel_quantity || null,
        problem_type || null, problem_notes || null,
        ml.price, payment_method || 'cash',
        ml.eta, ml.demand, ml.confidence,
      ]
    );

    // Auto-find best ML-scored provider nearby
    const [providers] = await db.query(
      `SELECT sp.id, u.first_name, u.last_name, sp.business_name, sp.ml_score,
              sp.latitude, sp.longitude,
              (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(sp.latitude))
              * COS(RADIANS(sp.longitude) - RADIANS(?))
              + SIN(RADIANS(?)) * SIN(RADIANS(sp.latitude)))) AS distance_km
       FROM service_providers sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.is_approved = 1
         AND sp.is_available = 1
         AND (sp.service_type = ? OR sp.service_type = 'both')
       HAVING distance_km < 20
       ORDER BY sp.ml_score DESC, distance_km ASC
       LIMIT 3`,
      [latitude, longitude, latitude,
       service_type === 'fuel_delivery' ? 'fuel_station' : 'mechanic']
    );

    res.status(201).json({
      success:    true,
      message:    'Request submitted successfully.',
      request_id: result.insertId,
      ml_estimate: ml,
      nearby_providers: providers,
    });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────
// GET /api/requests  — Get all requests for logged-in user
// ────────────────────────────────────────
exports.getMyRequests = async (req, res, next) => {
  try {
    const isProvider = ['mechanic','fuel_station'].includes(req.user.role);
    let rows;

    if (isProvider) {
      const [sp] = await db.query('SELECT id FROM service_providers WHERE user_id = ?', [req.user.id]);
      if (!sp.length) return res.status(404).json({ success: false, message: 'Provider profile not found.' });

      [rows] = await db.query(
        `SELECT sr.*, u.first_name, u.last_name, u.phone
         FROM service_requests sr
         JOIN users u ON sr.customer_id = u.id
         WHERE sr.provider_id = ?
         ORDER BY sr.requested_at DESC`,
        [sp[0].id]
      );
    } else {
      [rows] = await db.query(
        `SELECT sr.*, sp.business_name, u2.first_name AS provider_first, u2.last_name AS provider_last
         FROM service_requests sr
         LEFT JOIN service_providers sp ON sr.provider_id = sp.id
         LEFT JOIN users u2 ON sp.user_id = u2.id
         WHERE sr.customer_id = ?
         ORDER BY sr.requested_at DESC`,
        [req.user.id]
      );
    }

    res.status(200).json({ success: true, count: rows.length, requests: rows });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────
// GET /api/requests/:id  — Get single request
// ────────────────────────────────────────
exports.getRequest = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT sr.*,
              u.first_name, u.last_name, u.phone AS customer_phone,
              sp.business_name, sp.latitude AS provider_lat, sp.longitude AS provider_lng,
              u2.phone AS provider_phone
       FROM service_requests sr
       JOIN users u ON sr.customer_id = u.id
       LEFT JOIN service_providers sp ON sr.provider_id = sp.id
       LEFT JOIN users u2 ON sp.user_id = u2.id
       WHERE sr.id = ?`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Request not found.' });

    // Only the customer or assigned provider can view
    const req_data = rows[0];
    if (req_data.customer_id !== req.user.id && req.user.role === 'customer')
      return res.status(403).json({ success: false, message: 'Access denied.' });

    res.status(200).json({ success: true, request: req_data });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────
// PATCH /api/requests/:id/status  — Update request status
// ────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, provider_id, final_price } = req.body;
    const validStatuses = ['accepted','en_route','arrived','in_service','completed','cancelled'];

    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status value.' });

    const timestamps = {
      accepted:   'accepted_at',
      arrived:    'arrived_at',
      completed:  'completed_at',
    };
    const tsField = timestamps[status];
    const tsClause = tsField ? `, ${tsField} = NOW()` : '';

    await db.query(
      `UPDATE service_requests SET status = ?${tsClause}
       ${provider_id ? ', provider_id = ?' : ''}
       ${final_price ? ', final_price = ?, payment_status = "pending"' : ''}
       WHERE id = ?`,
      [
        status,
        ...(provider_id ? [provider_id] : []),
        ...(final_price ? [final_price] : []),
        req.params.id,
      ]
    );

    // Create notification for customer
    const { notifications } = require('../utils/notificationService');
    const [reqRow] = await db.query(
      'SELECT sr.customer_id, u.email, u.first_name, u.phone, sr.final_price FROM service_requests sr JOIN users u ON sr.customer_id = u.id WHERE sr.id = ?',
      [req.params.id]
    );
    if (reqRow.length) {
      const r = reqRow[0];
      const msgs = {
        accepted:   'Your request has been accepted! Provider is preparing.',
        en_route:   'Your provider is on the way! 🚐',
        arrived:    'Your provider has arrived at your location.',
        in_service: 'Service is currently in progress.',
        completed:  'Your service has been completed successfully. Please rate your experience.',
        cancelled:  'Your request has been cancelled.',
      };
      // Save to DB notification
      await db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
        [r.customer_id, `Request ${status.charAt(0).toUpperCase() + status.slice(1)}`, msgs[status], 'status']
      );
      // Send email + SMS for key status changes
      if (status === 'completed' && r.final_price) {
        notifications.onRequestCompleted(r.customer_id, r.email, r.first_name, r.final_price).catch(console.error);
      }
    }

    res.status(200).json({ success: true, message: `Request status updated to "${status}".` });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────
// GET /api/requests/pending  — Admin: all pending requests
// ────────────────────────────────────────
exports.getPendingRequests = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT sr.*, u.first_name, u.last_name, u.phone
       FROM service_requests sr
       JOIN users u ON sr.customer_id = u.id
       WHERE sr.status = 'pending'
       ORDER BY sr.requested_at ASC`
    );
    res.status(200).json({ success: true, count: rows.length, requests: rows });
  } catch (err) { next(err); }
};