const express = require('express');
const router = express.Router();
const { createSurvey, getAllSurveys, getActiveSurvey, updateSurvey, deleteSurvey } = require('../controllers/surveyController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.post('/', protect, adminOnly, createSurvey);
router.get('/', protect, getAllSurveys);
router.get('/active', protect, getActiveSurvey);
router.put('/:id', protect, adminOnly, updateSurvey);
router.delete('/:id', protect, adminOnly, deleteSurvey);

module.exports = router;
