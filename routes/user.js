const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// POST /api/v1/users/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ ok:false, code:'VALIDATION_FAILED', message:'필수 값 누락' });
    }
    if (!['brand','showhost'].includes(role)) {
      return res.status(400).json({ ok:false, code:'VALIDATION_FAILED', message:'role이 올바르지 않습니다' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok:false, code:'DUPLICATE', message:'이미 가입된 이메일입니다.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role });
    return res.status(201).json({ ok:true, userId: user._id.toString(), role: user.role });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ ok:false, code:'INTERNAL_ERROR', message:'서버 오류' });
  }
});

// POST /api/v1/users/login (참고)
// router.post('/login', ...)

module.exports = router;