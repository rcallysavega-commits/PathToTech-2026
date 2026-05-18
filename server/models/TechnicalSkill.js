const mongoose = require('mongoose');

const skillItemSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['Programming Languages', 'Web Development', 'Database', 'Tools'],
    required: true,
  },
  skillName: { type: String, required: true },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    required: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 10,
  },
});

const technicalSkillSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    skills: [skillItemSchema],
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TechnicalSkill', technicalSkillSchema);
