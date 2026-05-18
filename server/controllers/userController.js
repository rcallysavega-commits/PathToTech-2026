const User = require('../models/User');

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentNumber: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this user.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this user.' });
    }

    const allowedFields = ['fullName', 'studentNumber', 'gender', 'major', 'profilePicture'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, message: 'Profile updated.', user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllUsers, getUserById, updateUser };
