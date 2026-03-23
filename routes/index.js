// routes/requestRoutes.js
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const ctrl    = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect); // all request routes require login

router.post('/', [
  body('service_type').isIn(['fuel_delivery','mechanic','both']),
  body('latitude').isFloat(),
  body('longitude').isFloat(),
], ctrl.createRequest);

router.get('/',              ctrl.getMyRequests);
router.get('/pending',       authorize('admin'), ctrl.getPendingRequests);
router.get('/:id',           ctrl.getRequest);
router.patch('/:id/status',  ctrl.updateStatus);

module.exports = router;

// ──────────────────────────────────────────────────────
// routes/providerRoutes.js
const providerRouter = express.Router();
const {
  providerController: pCtrl,
  reviewController:   rCtrl,
  notifController,
} = require('../controllers/providerController');

providerRouter.get('/nearby',           pCtrl.getNearby);
providerRouter.get('/:id',             pCtrl.getProvider);
providerRouter.patch('/availability',  protect, pCtrl.toggleAvailability);

// ──────────────────────────────────────────────────────
// routes/reviewRoutes.js
const reviewRouter = express.Router();
reviewRouter.use(protect);
reviewRouter.post('/',             rCtrl.create);
reviewRouter.get('/provider/:id',  rCtrl.getForProvider);

// ──────────────────────────────────────────────────────
// routes/notificationRoutes.js
const notifRouter = express.Router();
notifRouter.use(protect);
notifRouter.get('/',             notifController.getAll);
notifRouter.patch('/read-all',   notifController.markAllRead);

// ──────────────────────────────────────────────────────
// routes/mlRoutes.js — ML Insights endpoints
const mlRouter  = express.Router();
const { mlEstimate, forecastDemand } = require('../utils/mlUtils');

mlRouter.post('/estimate', protect, (req, res) => {
  const estimate = mlEstimate(req.body);
  res.json({ success: true, estimate });
});

mlRouter.get('/forecast', protect, (req, res) => {
  const forecast = forecastDemand(req.query.area || 'general');
  res.json({ success: true, forecast });
});

module.exports = { requestRouter: router, providerRouter, reviewRouter, notifRouter, mlRouter };