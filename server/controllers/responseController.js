const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const { autoRefreshPredictionForUserId } = require('./predictionController');

const normalizeCategoryKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// POST /api/responses
const submitResponse = async (req, res) => {
  try {
    const { surveyId, answers, gender, major } = req.body;
    const userId = req.user._id;

    const survey = await Survey.findById(surveyId).select('sections.category').lean();
    if (!survey) {
      return res.status(404).json({ success: false, message: 'Survey not found.' });
    }

    // Check if already responded to this survey
    const existing = await SurveyResponse.findOne({ userId, surveyId });

    // Compute category scores from likert answers
    const categoryMap = {};
    answers.forEach((a) => {
      const categoryFromSection = survey.sections?.[a.sectionIndex]?.category;
      const category = normalizeCategoryKey(a.category || categoryFromSection || '');
      const answerValue = Number(a.answer);
      if (a.questionType === 'likert' && category && Number.isFinite(answerValue)) {
        if (!categoryMap[category]) categoryMap[category] = { sum: 0, count: 0 };
        categoryMap[category].sum += answerValue;
        categoryMap[category].count += 1;
      }
    });

    const categoryScores = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      average: parseFloat((data.sum / data.count).toFixed(2)),
      count: data.count,
    }));

    const totalAverage =
      categoryScores.length > 0
        ? parseFloat(
            (categoryScores.reduce((acc, c) => acc + c.average, 0) / categoryScores.length).toFixed(2)
          )
        : 0;

    let response;
    if (existing) {
      existing.answers = answers;
      existing.categoryScores = categoryScores;
      existing.totalAverage = totalAverage;
      existing.gender = gender || '';
      existing.major = major || '';
      existing.completed = true;
      existing.completedAt = new Date();
      response = await existing.save();
    } else {
      response = await SurveyResponse.create({
        userId,
        surveyId,
        answers,
        categoryScores,
        totalAverage,
        gender: gender || '',
        major: major || '',
        completed: true,
        completedAt: new Date(),
      });
    }

    // Auto-refresh prediction whenever survey answers change.
    await autoRefreshPredictionForUserId(userId);

    return res.status(200).json({ success: true, message: 'Survey submitted successfully.', response });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/responses/user/:userId
const getUserResponse = async (req, res) => {
  try {
    const response = await SurveyResponse.findOne({ userId: req.params.userId, completed: true })
      .sort({ completedAt: -1 })
      .populate('surveyId', 'title');
    return res.status(200).json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/responses/all
const getAllResponses = async (req, res) => {
  try {
    const responses = await SurveyResponse.find({ completed: true })
      .populate('userId', 'fullName email studentNumber')
      .populate('surveyId', 'title')
      .sort({ completedAt: -1 });
    return res.status(200).json({ success: true, count: responses.length, responses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { submitResponse, getUserResponse, getAllResponses };
