Overview:
RoadRescue is a full-stack, ML-powered web application that connects stranded vehicle owners with verified fuel delivery personnel and certified mechanics in real time. Think of it as **"Uber for roadside emergencies"** — intelligent, transparent, and always near.

The system integrates 7 Machine Learning models including a Python Flask ML Microservice that handles provider recommendation, breakdown hotspot prediction, dynamic pricing, and fraud detection — making every rescue smarter than the last.

Problem Statement :
Millions of drivers face fuel shortages and mechanical breakdowns daily with:
- No single platform for fuel delivery + mechanic assistance
- Phone-based, manual helplines with no tracking
- No intelligent dispatching — nearest provider wins regardless of quality
- No transparent pricing — users vulnerable to overcharging
- No fraud detection or provider accountability
- No way to predict breakdown-prone road segments

RoadRescue solves all of these in one unified, intelligent platform.

✨ Features

### 👤 Customer
- 📝 Register / Login with JWT authentication
- ⛽ Request **fuel delivery** (type, quantity, location)
- 🔧 Request **mechanic assistance** with photo + description upload
- 📍 Auto GPS detection + Google Places address search
- 🤖 ML-estimated **ETA, price, demand level** before confirming
- 🏆 View **RL-ranked nearby providers** with ML scores
- 🗺️ **Live GPS tracking** of provider via Google Maps
- 📊 5-step real-time status tracker
- ⭐ Rate and review after service completion
- 🔔 Email + SMS notifications at every step

### 🔧 Service Provider
- Toggle **online/offline** with real-time GPS
- Accept / reject incoming requests
- Update request status (en route → arrived → completed)
- ML score updated automatically from ratings

### 🛡️ Admin
- Full dashboard — requests, users, revenue, fraud alerts
- **Approve / reject** service providers
- **Broadcast notifications** to all users
- View **7 ML model performance metrics**
- Fraud log — suspend providers, resolve cases
- Payment analytics and revenue tracking
