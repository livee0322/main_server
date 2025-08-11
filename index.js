// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ──────────────────────────────────────────────────────
// CORS (필요 시 화이트리스트로 교체)
// ──────────────────────────────────────────────────────
const ALLOW = [
  'https://livee0322.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                 // 서버 헬스체크/내부 호출
    if (ALLOW.includes(origin)) return cb(null, true);
    return cb(null, true); // 필요하면 false로 바꾸고 화이트리스트만 허용
  },
  credentials: false
}));
app.use(express.json());

// ──────────────────────────────────────────────────────
// DB
// ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
})
.then(()=>console.log('✅ MongoDB connected'))
.catch(err=>console.error('❌ MongoDB connect error:', err));

// ──────────────────────────────────────────────────────
/** 공통 응답 헬퍼 */
// ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) =>
    res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

// ──────────────────────────────────────────────────────
// 라우터 (파일명과 정확히 1:1 매칭!)
// ──────────────────────────────────────────────────────
// ⚠️ routes 폴더에 실제 파일명은 단수형입니다.
const users      = require('./routes/user');       // routes/user.js
const portfolios = require('./routes/portfolio');  // routes/portfolio.js
const recruits   = require('./routes/recruit');    // routes/recruit.js

// 버저닝된 메인 엔드포인트(옵션 B 통일)
const V1 = '/api/v1';
app.use(`${V1}/users`, users);
app.use(`${V1}/portfolios`, portfolios);
app.use(`${V1}/recruits`, recruits);

// (옵션) 구버전 호환 경로 유지가 필요하면 아래 계속 살려두세요.
app.use('/api/auth', users);        // /signup, /login, /me
app.use('/api/portfolio', portfolios);
app.use('/api/recruit', recruits);

// Health
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));

// 에러 핸들러(최하단)
app.use((err, _req, res, _next) => {
  console.error('🔥', err);
  res.fail(err.message || '서버 오류', 'INTERNAL_ERROR', err.status || 500);
});

// Render는 PORT를 env로 내려줍니다(하드코딩 금지)
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Server listening on ${port}`));