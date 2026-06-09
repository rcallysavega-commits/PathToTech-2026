const FAQ = require('../models/FAQ');

// GET /api/faqs — public (student widget)
const getFAQs = async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isVisible: true };
    const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch FAQs.' });
  }
};

// POST /api/faqs — admin only
const createFAQ = async (req, res) => {
  try {
    const { question, answer, order, isVisible } = req.body;
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ success: false, message: 'Question and answer are required.' });
    }
    const count = await FAQ.countDocuments();
    const faq = await FAQ.create({
      question: question.trim(),
      answer: answer.trim(),
      order: order !== undefined ? Number(order) : count,
      isVisible: isVisible !== undefined ? Boolean(isVisible) : true,
    });
    res.status(201).json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create FAQ.' });
  }
};

// PUT /api/faqs/:id — admin only
const updateFAQ = async (req, res) => {
  try {
    const { question, answer, order, isVisible } = req.body;
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found.' });

    if (question !== undefined) faq.question = question.trim();
    if (answer !== undefined) faq.answer = answer.trim();
    if (order !== undefined) faq.order = Number(order);
    if (isVisible !== undefined) faq.isVisible = Boolean(isVisible);

    await faq.save();
    res.json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update FAQ.' });
  }
};

// DELETE /api/faqs/:id — admin only
const deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndDelete(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found.' });
    res.json({ success: true, message: 'FAQ deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete FAQ.' });
  }
};

// PUT /api/faqs/reorder — admin only — bulk order update
const reorderFAQs = async (req, res) => {
  try {
    const { items } = req.body; // [{ _id, order }]
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items array required.' });
    }
    await Promise.all(
      items.map(({ _id, order }) => FAQ.findByIdAndUpdate(_id, { order: Number(order) }))
    );
    res.json({ success: true, message: 'Order updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reorder FAQs.' });
  }
};

module.exports = { getFAQs, createFAQ, updateFAQ, deleteFAQ, reorderFAQs };
