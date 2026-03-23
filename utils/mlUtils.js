// utils/mlUtils.js — Machine Learning Utility Functions
// These simulate ML model outputs.
// In production, replace with trained model calls (TensorFlow.js / Python microservice)

// ─────────────────────────────────────────────────────
// 1. ML ESTIMATE — ETA + Price + Demand (Regression + RL)
// ─────────────────────────────────────────────────────
const mlEstimate = ({ latitude, longitude, service_type, fuel_quantity }) => {
  const hour    = new Date().getHours();
  const day     = new Date().getDay(); // 0=Sun, 5=Fri

  // Demand level based on time of day + day of week
  let demand = 'low';
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) demand = 'high';
  else if ((hour >= 10 && hour <= 16) || (hour >= 21 && hour <= 22)) demand = 'medium';
  if (day === 5 || day === 6) demand = demand === 'low' ? 'medium' : 'high'; // Fri/Sat spike

  // ETA: base 8 min, adjusted by demand
  const demandFactor = { low: 0.8, medium: 1.0, high: 1.4 };
  const baseEta = service_type === 'fuel_delivery' ? 10 : 12;
  const eta = Math.round(baseEta * demandFactor[demand]);

  // Price: base by service type + demand surge
  const surchargeFactor = { low: 1.0, medium: 1.15, high: 1.35 };
  let basePrice = service_type === 'fuel_delivery'
    ? 1500 + (parseFloat(fuel_quantity) || 10) * 200
    : 3500;
  const price = Math.round(basePrice * surchargeFactor[demand]);

  // ML confidence (simulated: higher in low demand)
  const confidence = demand === 'low' ? 94 : demand === 'medium' ? 88 : 79;

  return {
    eta,
    price,
    demand,
    confidence,
    note: demand === 'high'
      ? 'Peak hours — slight surge pricing applied'
      : 'Off-peak — standard pricing active',
  };
};

// ─────────────────────────────────────────────────────
// 2. RL PROVIDER SCORE — Reinforcement Learning dispatch score
//    In production this would be a trained RL model.
//    Inputs: distance, rating, response_time history, total rescues
// ─────────────────────────────────────────────────────
const rlProviderScore = ({ distance_km, avg_rating, total_rescues, base_ml_score }) => {
  const distancePenalty  = Math.min(distance_km * 2, 30);     // closer = better
  const ratingBonus      = (avg_rating / 5) * 30;              // max +30
  const experienceBonus  = Math.min(total_rescues / 10, 20);   // max +20
  const score = Math.round(
    (base_ml_score || 50) + ratingBonus + experienceBonus - distancePenalty
  );
  return Math.max(0, Math.min(100, score));
};

// ─────────────────────────────────────────────────────
// 3. FRAUD DETECTION — Anomaly detection (rule-based baseline)
//    In production: Isolation Forest / DBSCAN model
// ─────────────────────────────────────────────────────
const detectFraud = ({ price_charged, estimated_price, completion_time_mins, rating }) => {
  const anomalies = [];

  if (price_charged > estimated_price * 1.5)
    anomalies.push({ type: 'overcharging', severity: 'high',
      detail: `Charged ₦${price_charged} vs estimate ₦${estimated_price}` });

  if (completion_time_mins < 2)
    anomalies.push({ type: 'fake_completion', severity: 'high',
      detail: `Service completed in ${completion_time_mins} min — suspiciously fast` });

  if (rating <= 2 && price_charged > estimated_price)
    anomalies.push({ type: 'poor_service', severity: 'medium',
      detail: 'Low rating combined with overcharging detected' });

  return { is_fraudulent: anomalies.length > 0, anomalies };
};

// ─────────────────────────────────────────────────────
// 4. DEMAND FORECAST — Time-series demand for an area
//    In production: LSTM / Prophet model
// ─────────────────────────────────────────────────────
const forecastDemand = (area_label) => {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // Simulated weekly demand percentages
  const demandProfile = [40, 55, 68, 50, 100, 72, 35];
  return days.map((day, i) => ({
    day,
    demand_pct: demandProfile[i],
    level: demandProfile[i] >= 70 ? 'high' : demandProfile[i] >= 50 ? 'medium' : 'low',
  }));
};

module.exports = { mlEstimate, rlProviderScore, detectFraud, forecastDemand };