# Aletheia Satellite Data Platform

![Aletheia Platform](public/favicon.svg)

**Aletheia** is an advanced decision-intelligence platform that fuses multi-sensor satellite data with ground intelligence to provide actionable insights for sustainable and predictable operations. 

🌐 **Live Application:** [https://mss26-satdat-pirru.web.app](https://mss26-satdat-pirru.web.app)

---

## 🚀 Features

The platform is structured into core operational pillars to monitor critical infrastructure from space:

1. **Operational Efficiency**
   - Monitors flaring limits, downtime, productivity, and refinery capacity utilization.
   - Utilizes VIIRS (Nightfire) satellite data to track combustion and emissions over time.

2. **Asset Security**
   - Tracks physical footprint expansion, border integrity, and critical infrastructure changes.
   - Analyzes boundary anomalies using Sentinel-2 (Optical) and Sentinel-1 (SAR) to identify potential oil spills or security events.

3. **Sustainability & Compliance**
   - Independent satellite verification of methane and flaring.
   - Leverages TROPOMI data to provide independent monitoring against self-reported operator figures.

4. **Aletheia AI Chatbot**
   - A grounded, read-only AI assistant that parses facility state and local data to answer context-specific questions.
   - Prevents hallucinations by adhering to a strict "Honesty Contract" based exclusively on the loaded `facilities.json` dataset.

5. **Global Internationalization (i18n)**
   - Fully localized in English, Spanish, and French, automatically adjusting the dashboard metrics and LLM AI prompt context dynamically.

---

## 🏗️ High-Level Architecture

The platform is designed to be lightweight, incredibly fast, and highly decoupled. By leveraging modern Vanilla JavaScript and Vite, it achieves maximum performance without the overhead of heavy SPA frameworks.

### Frontend Presentation Layer
- **Vite:** Blazing fast build tool and development server.
- **Vanilla JavaScript & CSS3:** Strict control over DOM and performance. Features sleek "glassmorphism" aesthetics built purely with custom CSS.
- **Leaflet.js:** Core geospatial engine handling interactive maps, multiple sensor overlays (SAR, TROPOMI, Planet Labs), and simulated pulse markers.
- **Chart.js:** Renders interactive, multi-axis historical trajectory charts directly within side panels.

### Core Logic Modules
- `src/main.js`: The central orchestrator handling map initialization, global state, authentication, and the Sustainability and Asset Security pillars.
- `src/operational_efficiency.js`: Pluggable module specifically tailored for flaring and operational uptime analysis.
- `src/ask_aletheia.js`: The deterministic global AI Chatbot engine enforcing the strict context boundaries.

### Data Pipeline Layer
- `pipeline/facilities.json`: Acts as the **Single Source of Truth**. A pre-compiled JSON dataset mapping facility coordinates, multi-language data strings, abatement scenarios, and satellite observations.

### Cloud Infrastructure
- **Firebase Hosting:** Global CDN deployment for static asset delivery.
- **Firebase Authentication:** Handles secure user login (Google Sign-In).
- **Cloud Firestore:** Manages user profile structures and authorization roles.

---

## 💻 Local Development

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v16+ recommended)
- npm or yarn

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repo-url>
   cd SatDat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your API keys:
   ```env
   PLANET_API_KEY=your_planet_api_key
   FIRMS_MAP_KEY=your_nasa_firms_key
   SH_INSTANCE_ID=your_sentinel_hub_instance_id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

### Firebase Deployment
To deploy the application to Firebase Hosting:
```bash
npm run build
firebase deploy --only hosting
```

---

## 🔐 Honesty Contract
The Aletheia AI Chatbot enforces an explicit `ALETHEIA_HANDOFF.md` strict system prompt. All outputs are strictly observed versus local background. The AI is structurally prevented from inventing operator disclosure gaps, hallucinating external data, or mixing distinct measurement methodologies (basin vs. point-source).
