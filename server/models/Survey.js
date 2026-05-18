const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['likert', 'multiple_choice', 'dropdown', 'text'],
    default: 'likert',
  },
  options: [String],
  required: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
});

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  questions: [questionSchema],
  order: { type: Number, default: 0 },
});

const surveySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    sections: [sectionSchema],
    isActive: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Survey', surveySchema);
