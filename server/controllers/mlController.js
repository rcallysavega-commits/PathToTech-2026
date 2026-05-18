const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const proxyMLRequest = async (endpoint, res) => {
  try {
    const response = await axios.get(`${ML_URL}${endpoint}`, { timeout: 15000 });
    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(`ML proxy error for ${endpoint}:`, error.message);
    return res.status(503).json({
      success: false,
      message: 'ML service is unavailable. Please ensure the ML service is running.',
      error: error.message,
    });
  }
};

// GET /api/ml/training-info
const getTrainingInfo = (req, res) => proxyMLRequest('/training-info', res);

// GET /api/ml/features
const getFeatures = (req, res) => proxyMLRequest('/features', res);

// GET /api/ml/model-summary
const getModelSummary = (req, res) => proxyMLRequest('/model-summary', res);

// GET /api/ml/dataset-options
const getDatasetOptions = (req, res) => proxyMLRequest('/dataset-options', res);

// POST /api/ml/patterns/discover
const discoverPatterns = async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL}/patterns/discover`, req.body || {}, { timeout: 30000 });
    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error('ML proxy error for /patterns/discover:', error.response?.data || error.message);
    return res.status(503).json({
      success: false,
      message: 'ML pattern discovery is unavailable. Please ensure the ML service is running.',
      error: error.message,
    });
  }
};

module.exports = { getTrainingInfo, getFeatures, getModelSummary, getDatasetOptions, discoverPatterns };
