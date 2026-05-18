const SoftSkill = require('../models/SoftSkill');
const { autoRefreshPredictionForUserId } = require('./predictionController');

const computeAverage = (scores) => {
  const vals = Object.values(scores).filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (!vals.length) return 0;
  return parseFloat((vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(2));
};

// POST /api/soft-skills
const saveSoftSkills = async (req, res) => {
  try {
    const { scores } = req.body;
    const userId = req.user._id;
    const average = computeAverage(scores);
    const completed = average > 0;

    const existing = await SoftSkill.findOne({ userId });
    let result;
    if (existing) {
      existing.scores = scores;
      existing.average = average;
      existing.completed = completed;
      result = await existing.save();
    } else {
      result = await SoftSkill.create({ userId, scores, average, completed });
    }

    await autoRefreshPredictionForUserId(userId);

    return res.status(200).json({ success: true, message: 'Soft skills saved.', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/soft-skills/:userId
const getSoftSkills = async (req, res) => {
  try {
    const data = await SoftSkill.findOne({ userId: req.params.userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/soft-skills/:userId
const updateSoftSkills = async (req, res) => {
  try {
    const { scores } = req.body;
    const average = computeAverage(scores);
    const data = await SoftSkill.findOneAndUpdate(
      { userId: req.params.userId },
      { scores, average, completed: average > 0 },
      { new: true, upsert: true }
    );
    await autoRefreshPredictionForUserId(req.params.userId);
    return res.status(200).json({ success: true, message: 'Soft skills updated.', data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { saveSoftSkills, getSoftSkills, updateSoftSkills };
