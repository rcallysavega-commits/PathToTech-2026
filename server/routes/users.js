const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.get('/', protect, adminOnly, getAllUsers);
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);

module.exports = router;
