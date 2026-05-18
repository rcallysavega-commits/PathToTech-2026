const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { exportTabularPdf } = require('../controllers/exportController');

router.post('/pdf', protect, exportTabularPdf);

module.exports = router;