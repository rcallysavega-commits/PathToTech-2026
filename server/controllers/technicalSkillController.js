const TechnicalSkill = require('../models/TechnicalSkill');
const { autoRefreshPredictionForUserId } = require('./predictionController');

// POST /api/technical-skills
const saveTechnicalSkills = async (req, res) => {
  try {
    const { skills } = req.body;
    const userId = req.user._id;

    const completed = Array.isArray(skills) && skills.length > 0;

    const existing = await TechnicalSkill.findOne({ userId });
    let result;
    if (existing) {
      existing.skills = skills || [];
      existing.completed = completed;
      result = await existing.save();
    } else {
      result = await TechnicalSkill.create({ userId, skills: skills || [], completed });
    }

    await autoRefreshPredictionForUserId(userId);

    return res.status(200).json({ success: true, message: 'Technical skills saved.', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/technical-skills/:userId
const getTechnicalSkills = async (req, res) => {
  try {
    const data = await TechnicalSkill.findOne({ userId: req.params.userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/technical-skills/:userId
const updateTechnicalSkills = async (req, res) => {
  try {
    const { skills } = req.body;
    const completed = Array.isArray(skills) && skills.length > 0;
    const data = await TechnicalSkill.findOneAndUpdate(
      { userId: req.params.userId },
      { skills, completed },
      { new: true, upsert: true }
    );
    await autoRefreshPredictionForUserId(req.params.userId);
    return res.status(200).json({ success: true, message: 'Technical skills updated.', data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { saveTechnicalSkills, getTechnicalSkills, updateTechnicalSkills };
