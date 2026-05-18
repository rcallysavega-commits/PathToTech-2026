const SkillOptions = require('../models/SkillOptions');

// Default data (mirrors constants.js)
const DEFAULT_TECH = [
  {
    category: 'Programming Languages',
    skills: ['Python','Java','JavaScript','TypeScript','C','C++','C#','PHP','Go','Rust','Kotlin','Swift','Dart','R','MATLAB','Ruby','Scala','Perl','Shell/Bash','SQL'],
  },
  { category: 'Web Development', skills: ['HTML','CSS','React.js','Node.js','Express.js','Laravel'] },
  { category: 'Database', skills: ['MySQL','MongoDB','Firebase','PostgreSQL'] },
  { category: 'Tools', skills: ['Git','GitHub','VS Code','Docker','Figma'] },
];

const DEFAULT_SOFT = [
  { key: 'communication', label: 'Communication' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'problemSolving', label: 'Problem-solving' },
  { key: 'adaptability', label: 'Adaptability' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'timeManagement', label: 'Time Management' },
  { key: 'criticalThinking', label: 'Critical Thinking' },
  { key: 'professionalism', label: 'Professionalism' },
];

// GET /api/skill-options/technical  (public)
const getTechnicalOptions = async (req, res) => {
  try {
    let doc = await SkillOptions.findOne({ type: 'technical' });
    if (!doc) {
      doc = await SkillOptions.create({ type: 'technical', categories: DEFAULT_TECH, items: [] });
    }
    return res.json({ success: true, data: doc.categories });
  } catch (err) {
    console.error('getTechnicalOptions error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/skill-options/soft  (public)
const getSoftOptions = async (req, res) => {
  try {
    let doc = await SkillOptions.findOne({ type: 'soft' });
    if (!doc) {
      doc = await SkillOptions.create({ type: 'soft', categories: [], items: DEFAULT_SOFT });
    }
    return res.json({ success: true, data: doc.items });
  } catch (err) {
    console.error('getSoftOptions error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/skill-options/technical  (admin only)
const updateTechnicalOptions = async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ success: false, message: 'categories must be an array' });
    }
    const doc = await SkillOptions.findOneAndUpdate(
      { type: 'technical' },
      { categories },
      { new: true, upsert: true, runValidators: true }
    );
    return res.json({ success: true, data: doc.categories });
  } catch (err) {
    console.error('updateTechnicalOptions error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/skill-options/soft  (admin only)
const updateSoftOptions = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items must be an array' });
    }
    const doc = await SkillOptions.findOneAndUpdate(
      { type: 'soft' },
      { items },
      { new: true, upsert: true, runValidators: true }
    );
    return res.json({ success: true, data: doc.items });
  } catch (err) {
    console.error('updateSoftOptions error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getTechnicalOptions, getSoftOptions, updateTechnicalOptions, updateSoftOptions };
