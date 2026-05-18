const express = require('express');
const router = express.Router();
const { getLandingContent, updateLandingContent } = require('../controllers/landingContentController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.get('/', getLandingContent);
router.put('/', protect, adminOnly, updateLandingContent);

module.exports = router;