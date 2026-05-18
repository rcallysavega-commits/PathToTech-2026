const express = require('express');
const router = express.Router();
const {
  getTechnicalOptions,
  getSoftOptions,
  updateTechnicalOptions,
  updateSoftOptions,
} = require('../controllers/skillOptionsController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

// Public reads (students need these without auth issues)
router.get('/technical', getTechnicalOptions);
router.get('/soft', getSoftOptions);

// Admin writes
router.put('/technical', protect, adminOnly, updateTechnicalOptions);
router.put('/soft', protect, adminOnly, updateSoftOptions);

module.exports = router;
