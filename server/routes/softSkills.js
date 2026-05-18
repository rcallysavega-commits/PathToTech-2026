const express = require('express');
const router = express.Router();
const { saveSoftSkills, getSoftSkills, updateSoftSkills } = require('../controllers/softSkillController');
const { protect } = require('../middleware/auth');

router.post('/', protect, saveSoftSkills);
router.get('/:userId', protect, getSoftSkills);
router.put('/:userId', protect, updateSoftSkills);

module.exports = router;
