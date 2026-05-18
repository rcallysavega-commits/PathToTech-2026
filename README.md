# PathToTech: Employability Prediction System

A full-stack MERN application with a Python ML service for predicting employability readiness of Computer Studies students.

## Tech Stack

- **Frontend:** React + Vite -> Vercel
- **Backend:** Node.js + Express + MongoDB Atlas -> Render
- **ML Service:** Python FastAPI -> Render
- **Database:** MongoDB Atlas

## Folder Structure

```text
/pathtotech
  /client       -> React + Vite frontend
  /server       -> Node.js + Express backend
  /ml-service   -> Python FastAPI ML service
```

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repo-url>
cd pathtotech
```

### 2. Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Fill in your .env values
npm run seed      # Seeds the admin account
npm run dev       # Start dev server
```

### 3. Frontend Setup

```bash
cd client
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

### 4. ML Service Setup

```bash
cd ml-service
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
uvicorn app:app --reload --port 8000
```

## Environment Variables

### Server (.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `CLIENT_URL` | Frontend URL (Vercel) |
| `ML_SERVICE_URL` | ML service URL (Render) |
| `EMAIL_HOST` | SMTP host (smtp.gmail.com) |
| `EMAIL_PORT` | SMTP port (587) |
| `EMAIL_USER` | Gmail address for sending OTP |
| `EMAIL_PASS` | Gmail app password |
| `ADMIN_EMAIL` | Initial admin email |
| `ADMIN_PASSWORD` | Initial admin password |
| `ADMIN_NAME` | Initial admin full name |

### Client (.env)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

### ML Service (.env)

| Variable | Description |
|----------|-------------|
| `PORT` | ML service port (default: 8000) |
| `DATASET_PATH` | Path to employability dataset |

## Deployment

### Frontend -> Vercel
1. Push `client/` to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Backend -> Render
1. Push `server/` to GitHub
2. Create Web Service in Render
3. Set environment variables from `server/.env.example`
4. Deploy with `npm start`

### ML Service -> Render
1. Push `ml-service/` to GitHub
2. Create Web Service in Render (Python)
3. Set `DATASET_PATH=./dataset/employability.xlsx`
4. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project -> Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized origins: `http://localhost:5173`, your Vercel URL
5. Add authorized redirect URIs accordingly
6. Copy Client ID to both `.env` files

## Admin Account

The admin account is auto-seeded when the server starts for the first time.
Default credentials are set in `server/.env`:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Machine Learning

The ML service combines **Gaussian Mixture Model (GMM)** and **ECLAT association mining**.

- GMM learns probabilistic employability and career clusters from normalized profile features.
- ECLAT discovers frequent feature patterns and supports recommendation reasoning.
- The model is automatically trained on startup using the dataset at `/ml-service/dataset/employability.xlsx`.

### Prediction Input Features
- GWA (Grade Weighted Average)
- Survey category averages (9 categories)
- Technical skills count
- Soft skills average
- Certification count

### Prediction Outputs
- `employabilityScore` (0-100 weighted score)
- `scoreBasedStatus` (threshold-based: High >= 75, Moderate >= 50, Low < 50)
- `gmmBasedStatus` (cluster/profile-based status)
- `employabilityStatus` (final status currently follows GMM-based status)
- `clusterLabel` (career track label)
- `jobRecommendations` (top job matches)
- `recommendations` (improvement action plan)

### Status Decision Note
The API returns both score-based and GMM-based statuses for transparency.
If they differ, the final `employabilityStatus` follows `gmmBasedStatus`.
# PathToTech2026
