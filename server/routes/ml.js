const express = require('express');
const router = express.Router();
const { getTrainingInfo, getFeatures, getModelSummary, getDatasetOptions, discoverPatterns } = require('../controllers/mlController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.get('/training-info', protect, adminOnly, getTrainingInfo);
router.get('/features', protect, adminOnly, getFeatures);
router.get('/model-summary', protect, adminOnly, getModelSummary);
router.get('/dataset-options', protect, getDatasetOptions);
router.post('/patterns/discover', protect, adminOnly, discoverPatterns);

module.exports = router;
