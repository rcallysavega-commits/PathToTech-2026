const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  sectionIndex: Number,
  questionIndex: Number,
  questionText: String,
  questionType: String,
  answer: mongoose.Schema.Types.Mixed, // number for likert, string for text/mc
});

const categoryScoreSchema = new mongoose.Schema({
  category: String,
  average: Number,
  count: Number,
});

const surveyResponseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
    answers: [answerSchema],
    categoryScores: [categoryScoreSchema],
    totalAverage: { type: Number, default: 0 },
    gender: { type: String, default: '' },
    major: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
