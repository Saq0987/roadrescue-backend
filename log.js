// routes/index.js — All Routes
const express  = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');

// ── Request Router ──
const requestRouter = express.Router();
const ctrl = require('../controllers/requestController');

requestRouter.use(protect);
requestRouter.post('/', [
  body('service_type').isIn(['fuel_delivery','mechanic','both']),
  body('latitude').isFloat(),
  body('longitude').isFloat(),
], ctrl.createRequest);
requestRouter.get('/',             ctrl.getMyRequests);
requestRouter.get('/pending',      authorize('admin'), ctrl.getPendingRequests);
requestRouter.get('/:id',          ctrl.getRequest);
requestRouter.patch('/:id/status', ctrl.updateStatus);

// ── Provider Router ──
const providerRouter = express.Router();
const { providerController: pCtrl, reviewController: rCtrl, notifController } = require('../controllers/providerController');

providerRouter.get('/nearby',          pCtrl.getNearby);
providerRouter.get('/:id',             pCtrl.getProvider);
providerRouter.patch('/availability',  protect, pCtrl.toggleAvailability);

// ── Review Router ──
const reviewRouter = express.Router();
reviewRouter.use(protect);
reviewRouter.post('/',            rCtrl.create);
reviewRouter.get('/provider/:id', rCtrl.getForProvider);

// ── Notification Router ──
const notifRouter = express.Router();
notifRouter.use(protect);
notifRouter.get('/',           notifController.getAll);
notifRouter.patch('/read-all', notifController.markAllRead);
notifRouter.post('/broadcast', authorize('admin'), async (req, res, next) => {
  try {
    const { title, message, role } = req.body;
    if (!title || !message)
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    const { broadcastToAll } = require('../utils/notificationService');
    const result = await broadcastToAll(title, message, role || null);
    res.json({ success: true, message: `Notification sent to ${result.sent} users.`, ...result });
  } catch (err) { next(err); }
});

// ── ML Router ──
const mlRouter = express.Router();
const { mlEstimate, forecastDemand } = require('../utils/mlUtils');

mlRouter.post('/estimate', protect, (req, res) => {
  const estimate = mlEstimate(req.body);
  res.json({ success: true, estimate });
});
mlRouter.get('/forecast', protect, (req, res) => {
  const forecast = forecastDemand(req.query.area || 'general');
  res.json({ success: true, forecast });
});

// ── Single Export ──
module.exports = { requestRouter, providerRouter, reviewRouter, notifRouter, mlRouter };