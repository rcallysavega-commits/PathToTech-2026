const express = require('express');
const router = express.Router();
const { generatePrediction, getMyResult } = require('../controllers/predictionController');
const { protect } = require('../middleware/auth');

router.post('/:studentNumber', protect, generatePrediction);
router.get('/my/result', protect, getMyResult);

module.exports = router;
