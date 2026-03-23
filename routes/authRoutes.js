// routes/authRoutes.js
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['customer','mechanic','fuel_station']),
], register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], login);

router.get('/me', protect, getMe);

module.exports = router;