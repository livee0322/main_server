// index.js (루트)
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* 기본 설정 */
app.use(cors());
app.use(express.json());

/* DB 연결 */
if (!process.env.MONGO_URI) {
  console.warn('⚠️  MONGO_URI 가 설정되지 않았습니다. Render의 Environment Variables를 확인하세요.');
}
mongoose.connect(process.env.MONGO_URI, { autoIndex: true })
  .then(()=> console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connect error:', err));

/* 응답 헬퍼 */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

/* 🔗 업로드 서명 라우터 연결 (이 줄이 중요!) */
const uploadsRouter = require('./routes/uploads');
app.use('/api/v1/uploads', uploadsRouter);

/* 다른 라우터들 */
const userRouter       = require('./routes/user');
const portfolioRouter  = require('./routes/portfolio');
const recruitRouter    = require('./routes/recruit');

app.use('/api/v1/users',      userRouter);
app.use('/api/v1/portfolios', portfolioRouter);
app.use('/api/v1/recruits',   recruitRouter);

// 구버전 호환(옵션)
app.use('/api/auth',      userRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/recruit',   recruitRouter);

/* 헬스체크 */
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));

/* 에러 핸들러 */
app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled Error:', err);
  res.fail(err.message || '서버 오류', 'INTERNAL_ERROR', err.status || 500);
});

/* 시작 */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Server listening on ${port}`));