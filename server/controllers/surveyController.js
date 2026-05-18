const Survey = require('../models/Survey');

// POST /api/surveys
const createSurvey = async (req, res) => {
  try {
    const survey = await Survey.create({ ...req.body, createdBy: req.user._id });
    return res.status(201).json({ success: true, message: 'Survey created.', survey });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/surveys
const getAllSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find().populate('createdBy', 'fullName email').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, surveys });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/surveys/active
const getActiveSurvey = async (req, res) => {
  try {
    const survey = await Survey.findOne({ isActive: true });
    if (!survey) return res.status(404).json({ success: false, message: 'No active survey found.' });
    return res.status(200).json({ success: true, survey });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/surveys/:id
const updateSurvey = async (req, res) => {
  try {
    // If activating this survey, deactivate others
    if (req.body.isActive === true) {
      await Survey.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    }
    const survey = await Survey.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
    return res.status(200).json({ success: true, message: 'Survey updated.', survey });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/surveys/:id
const deleteSurvey = async (req, res) => {
  try {
    const survey = await Survey.findByIdAndDelete(req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
    return res.status(200).json({ success: true, message: 'Survey deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createSurvey, getAllSurveys, getActiveSurvey, updateSurvey, deleteSurvey };
