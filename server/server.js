require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

const normalizeOrigin = (value = '') => String(value).trim().replace(/\/+$/, '').toLowerCase();

const parseAllowedOrigins = () => {
  const envOrigins = [process.env.FRONTEND_URL, process.env.CLIENT_URL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  return [...new Set(envOrigins)];
};

const staticAllowedOrigins = [
  'https://path-to-tech-2026.vercel.app',
  'https://www.path-to-tech-2026.vercel.app',
  'https://path-to-tech-dcs.vercel.app',
  'https://www.path-to-tech-dcs.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
].map(normalizeOrigin);

const isAllowedOrigin = (origin = '') => {
  const normalizedOrigin = normalizeOrigin(origin);
  const allowedOrigins = [...parseAllowedOrigins(), ...staticAllowedOrigins];

  if (allowedOrigins.includes(normalizedOrigin)) return true;

  // Allow Vercel preview/prod deployments for this project.
  if (/^https:\/\/path-to-tech-(?:2026|dcs)(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(normalizedOrigin)) return true;

  return false;
};

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn('[cors] Blocked origin:', normalizeOrigin(origin));
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Targeted diagnostics for production registration issues.
app.use((req, res, next) => {
  const shouldTrace = req.path === '/api/auth/register' || req.path === '/api/auth/student-register';
  if (!shouldTrace) return next();

  const startedAt = Date.now();
  console.log('[register-trace] Incoming request', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin || null,
    userAgent: req.headers['user-agent'] || null,
  });

  res.on('finish', () => {
    console.log('[register-trace] Response sent', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/surveys', require('./routes/surveys'));
app.use('/api/responses', require('./routes/responses'));
app.use('/api/technical-skills', require('./routes/technicalSkills'));
app.use('/api/soft-skills', require('./routes/softSkills'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/grades', require('./routes/grades'));
app.use('/api/predict', require('./routes/predictions'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/results', require('./routes/results'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ml', require('./routes/ml'));
app.use('/api/skill-options', require('./routes/skillOptions'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/landing-content', require('./routes/landingContent'));
app.use('/api/faqs', require('./routes/faqs'));

app.get('/', (req, res) => {
  res.json({
    message: 'PathToTech API is running',
    version: '1.0.0',
    system: 'Employability Prediction System',
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'PathToTech API endpoint is reachable',
    version: '1.0.0',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const { seedAdmin } = require('./utils/seedAdmin');
    const { seedDefaultSurvey } = require('./utils/seedSurvey');
    await seedAdmin();
    await seedDefaultSurvey();

    app.listen(PORT, () => {
      console.log(`PathToTech Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
