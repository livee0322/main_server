// index.js (stable + reconnect)
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* ===== 기본 설정 ===== */
app.use(cors());
app.use(express.json());

/* ===== MongoDB 연결 ===== */
if (!process.env.MONGO_URI) {
  console.warn('⚠️ MONGO_URI 가 설정되지 않았습니다. Render 환경변수를 확인하세요.');
}

mongoose.set('strictQuery', true);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connect error:', err.message);
    setTimeout(connectDB, 5000); // 5초 후 재시도
  }
};

connectDB();

// 연결 이벤트 로그
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. 재연결 시도...');
  connectDB();
});
mongoose.connection.on('reconnected', () => {
  console.log('🔁 MongoDB reconnected');
});

/* ===== 응답 헬퍼 ===== */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (
    message = '요청을 처리할 수 없습니다.',
    code = 'INTERNAL_ERROR',
    status = 400,
    extra = {}
  ) => res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

/* ===== 라우터 ===== */
app.use('/api/v1/uploads',    require('./routes/uploads'));
app.use('/api/v1/users',      require('./routes/user'));
app.use('/api/v1/portfolios', require('./routes/portfolio'));
app.use('/api/v1/recruits',   require('./routes/recruit'));

// 구버전 호환
app.use('/api/auth',      require('./routes/user'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/recruit',   require('./routes/recruit'));

/* ===== 헬스체크 ===== */
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));
app.get('/healthz', (_req, res) => {
  const dbState = mongoose.connection.readyState; // 0=disconnected,1=connected
  res.ok({ dbState });
});

/* ===== 에러 핸들러 ===== */
app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled Error:', err);
  res.fail(err.message || '서버 오류', 'INTERNAL_ERROR', err.status || 500);
});

/* ===== 서버 시작 ===== */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Server listening on ${port}`));