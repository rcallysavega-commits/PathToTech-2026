const express = require('express');
const router = express.Router();
const { saveTechnicalSkills, getTechnicalSkills, updateTechnicalSkills } = require('../controllers/technicalSkillController');
const { protect } = require('../middleware/auth');

router.post('/', protect, saveTechnicalSkills);
router.get('/:userId', protect, getTechnicalSkills);
router.put('/:userId', protect, updateTechnicalSkills);

module.exports = router;
