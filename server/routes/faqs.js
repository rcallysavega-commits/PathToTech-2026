const express = require('express');
const router = express.Router();
const { getFAQs, createFAQ, updateFAQ, deleteFAQ, reorderFAQs } = require('../controllers/faqController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

// Public — student widget reads this
router.get('/', getFAQs);

// Admin only
router.post('/', protect, adminOnly, createFAQ);
router.put('/reorder', protect, adminOnly, reorderFAQs);
router.put('/:id', protect, adminOnly, updateFAQ);
router.delete('/:id', protect, adminOnly, deleteFAQ);

module.exports = router;
