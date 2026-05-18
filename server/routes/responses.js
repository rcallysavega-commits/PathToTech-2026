const express = require('express');
const router = express.Router();
const { submitResponse, getUserResponse, getAllResponses } = require('../controllers/responseController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.post('/', protect, submitResponse);
router.get('/all', protect, adminOnly, getAllResponses);
router.get('/user/:userId', protect, getUserResponse);

module.exports = router;
