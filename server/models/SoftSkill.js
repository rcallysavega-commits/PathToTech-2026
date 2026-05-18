const mongoose = require('mongoose');

const softSkillSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    scores: {
      communication: { type: Number, min: 1, max: 5 },
      teamwork: { type: Number, min: 1, max: 5 },
      problemSolving: { type: Number, min: 1, max: 5 },
      adaptability: { type: Number, min: 1, max: 5 },
      leadership: { type: Number, min: 1, max: 5 },
      timeManagement: { type: Number, min: 1, max: 5 },
      criticalThinking: { type: Number, min: 1, max: 5 },
      professionalism: { type: Number, min: 1, max: 5 },
    },
    average: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SoftSkill', softSkillSchema);
