const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../src/middleware/auth');

const signToken = (u) =>
  jwt.sign({ id: u._id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/signup',
  body('name').isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['brand', 'showhost', 'admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const { name, email, password, role = 'showhost' } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.fail('이미 가입된 이메일입니다.', 'DUPLICATE_EMAIL', 409);

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role });
    return res.ok({ message: '가입 완료', userId: user._id, role: user.role }, 201);
  }
);

router.post('/login',
  body('email').isEmail(),
  body('password').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.fail('이메일 또는 비밀번호가 올바르지 않습니다.', 'AUTH_FAILED', 401);

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.fail('이메일 또는 비밀번호가 올바르지 않습니다.', 'AUTH_FAILED', 401);

    const token = signToken(user);
    return res.ok({ message: '로그인 성공', token, name: user.name, role: user.role });
  }
);

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('_id name email role createdAt');
  if (!user) return res.fail('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND', 404);
  return res.ok({ user });
});

module.exports = router;