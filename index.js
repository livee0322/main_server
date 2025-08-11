// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS (필요시 origin 화이트리스트로 교체)
app.use(cors());
app.use(express.json());

// DB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('✅ MongoDB connected'))
  .catch(err=>console.error('❌ MongoDB connect error:', err));

// 공통 응답 헬퍼
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

// 라우터 (복수형 + 현재 경로에 맞춤)
const users = require('./routes/users');
const portfolios = require('./routes/portfolios');
const recruits = require('./routes/recruits');

// v1 표준 경로
app.use('/api/v1/users', users);
app.use('/api/v1/portfolios', portfolios);
app.use('/api/v1/recruits', recruits);

// (옵션) 구버전 호환 라우트 — 프론트가 아직 이전 경로면 살려두기
app.use('/api/auth', users);         // signup/login/me
app.use('/api/portfolio', portfolios);
app.use('/api/recruit', recruits);

// Health
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));

// 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error('🔥', err);
  res.fail(err.message || '서버 오류', 'INTERNAL_ERROR', err.status || 500);
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Server listening on ${port}`));