const express = require('express');
const router = express.Router();
const { getAllResults, getResultByStudent, archiveResult } = require('../controllers/predictionController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.get('/', protect, adminOnly, getAllResults);
router.put('/:id/archive', protect, adminOnly, archiveResult);
router.get('/:studentNumber', protect, getResultByStudent);

module.exports = router;
