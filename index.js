// index.js (루트)
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* ====== 기본 설정 ====== */
app.use(cors());               // 필요시 origin 화이트리스트로 조정
app.use(express.json());

/* ====== DB 연결 ====== */
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(()=> console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connect error:', err));

/* ====== 응답 헬퍼 ====== */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) =>
    res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});
// 서명 라우터 연결
const uploadsRouter = require('./routes/uploads');
app.use('/api/v1/uploads', uploadsRouter);

/* ====== 라우터 로드 (파일명 그대로) ====== */
const userRouter       = require('./routes/user');        // ./routes/user.js
const portfolioRouter  = require('./routes/portfolio');   // ./routes/portfolio.js
const recruitRouter    = require('./routes/recruit');     // ./routes/recruit.js

/* ====== v1 네임스페이스 ====== */
app.use('/api/v1/users',      userRouter);
app.use('/api/v1/portfolios', portfolioRouter);
app.use('/api/v1/recruits',   recruitRouter);

/* ====== (옵션) 구버전 호환 경로 ====== */
// 프론트가 /api/auth, /api/portfolio, /api/recruit 를 아직 쓰는 경우 대비
app.use('/api/auth',      userRouter);       // /signup, /login, /me 등
app.use('/api/portfolio', portfolioRouter);
app.use('/api/recruit',   recruitRouter);

/* ====== 헬스체크 ====== */
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));

/* ====== 에러 핸들러 ====== */
app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled Error:', err);
  res.fail(err.message || '서버 오류', 'INTERNAL_ERROR', err.status || 500);
});

/* ====== 시작 ====== */
const port = process.env.PORT || 8080; // Render용: PORT 꼭 환경변수 사용
app.listen(port, () => console.log(`✅ Server listening on ${port}`));