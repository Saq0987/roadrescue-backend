// controllers/authController.js — Register & Login
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { validationResult } = require('express-validator');

// ── Generate JWT ──
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { first_name, last_name, email, phone, password, role } = req.body;

    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered.' });

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, phone, password_hash, role || 'customer']
    );

    const userId = result.insertId;
    const token  = signToken({ id: userId, email, role: role || 'customer' });

    // Send welcome notification + email
    const { notifications } = require('../utils/notificationService');
    notifications.onRegister(userId, first_name, email).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: { id: userId, first_name, last_name, email, role: role || 'customer' },
    });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    // Find user
    const [rows] = await db.query(
      'SELECT id, first_name, last_name, email, password_hash, role, is_active FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user = rows[0];

    if (!user.is_active)
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = signToken(user);

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.first_name}!`,
      token,
      user: {
        id:         user.id,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email,
        role:       user.role,
      },
    });
  } catch (err) { next(err); }
};

// ────────────────────────────────────────
// GET /api/auth/me  (protected)
// ────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, first_name, last_name, email, phone, role, is_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    res.status(200).json({ success: true, user: rows[0] });
  } catch (err) { next(err); }
};