const mongoose = require('mongoose');

const SkillOptionsSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['technical', 'soft'], unique: true, required: true },
    // For type === 'technical'
    categories: [
      {
        category: { type: String, required: true },
        skills: [{ type: String }],
      },
    ],
    // For type === 'soft'
    items: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SkillOptions', SkillOptionsSchema);
