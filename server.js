require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ success: true, message: '🛣️ RoadRescue API is running', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '🛣️ RoadRescue API is running', version: '1.0.0' });
});

module.exports = app;