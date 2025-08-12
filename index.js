// src/index.js
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* =========================
 * 0) 환경변수 점검
 * ========================= */
const {
  PORT = 8080,
  NODE_ENV = 'production',
  MONGO_URI,              // ← 변수명 통일 (기존 MONGODB_URI 사용 금지)
  JWT_SECRET,
  CLOUDINARY_URL,         // 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET 조합
} = process.env;

if (!MONGO_URI) {
  console.warn('⚠️  MONGO_URI 가 설정되지 않았습니다. Render의 Environment Variables를 확인하세요.');
}
if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET 이 설정되지 않았습니다. 토큰 검증에 문제가 생길 수 있습니다.');
}
if (!CLOUDINARY_URL) {
  console.warn('⚠️  CLOUDINARY_URL 이 설정되지 않았습니다. (개별 키로 설정했다면 무시 가능)');
}

/* =========================
 * 1) 공통 미들웨어
 * ========================= */
app.set('trust proxy', 1); // Render/프록시 환경 대비
app.use(cors());           // 필요 시 origin 화이트리스트 적용
app.use(express.json({ limit: '2mb' })); // JSON 페이로드 기본 제한

// 간단 요청 로거(필요 시 morgan으로 교체)
app.use((req, _res, next) => {
  if (NODE_ENV !== 'production') {
    console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// 응답 헬퍼
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

/* =========================
 * 2) DB 연결 (재시도/종료처리)
 * ========================= */
mongoose.set('strictQuery', true);

const connectWithRetry = async (retries = 5, delayMs = 3000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(MONGO_URI, { // ← 환경변수명 통일
        autoIndex: true,
      });
      console.log('✅ MongoDB connected');
      return;
    } catch (err) {
      console.error(`❌ MongoDB connect error (${i}/${retries}):`, err.message);
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
};

/* =========================
 * 3) 라우터
 * ========================= */
// 업로드 서명 라우터 (Cloudinary)
const uploadsRouter    = require('./routes/uploads');      // ./routes/uploads.js
app.use('/api/v1/uploads', uploadsRouter);

// 도메인 라우터
const userRouter       = require('./routes/user');         // ./routes/user.js
const portfolioRouter  = require('./routes/portfolio');    // ./routes/portfolio.js
const recruitRouter    = require('./routes/recruit');      // ./routes/recruit.js

// v1 네임스페이스
app.use('/api/v1/users',      userRouter);
app.use('/api/v1/portfolios', portfolioRouter);
app.use('/api/v1/recruits',   recruitRouter);

// (옵션) 구버전 호환 경로
app.use('/api/auth',      userRouter);       // /signup, /login, /me 등
app.use('/api/portfolio', portfolioRouter);
app.use('/api/recruit',   recruitRouter);

/* =========================
 * 4) 헬스체크/베이스
 * ========================= */
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));
app.get('/healthz', (_req, res) => res.ok({ service: 'livee', env: NODE_ENV }));

/* =========================
 * 5) 404 & 에러 핸들러
 * ========================= */
app.use((req, res) => res.fail('존재하지 않는 경로입니다.', 'NOT_FOUND', 404));

app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled Error:', err);
  const status = err.status || 500;
  const msg = NODE_ENV === 'production' ? (err.message || '서버 오류') : (err.stack || err.message);
  res.fail(msg, 'INTERNAL_ERROR', status);
});

/* =========================
 * 6) 부팅 & 종료 그레이스풀
 * ========================= */
let server;
(async () => {
  try {
    await connectWithRetry();
    server = app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
  } catch (e) {
    console.error('🚫 Server start failed:', e);
    process.exit(1);
  }
})();

const shutdown = async (signal) => {
  console.log(`\n👋 ${signal} received. Shutting down...`);
  try {
    if (server) {
      await new Promise((res) => server.close(res));
      console.log('🛑 HTTP server closed.');
    }
    await mongoose.connection.close();
    console.log('🛑 MongoDB connection closed.');
    process.exit(0);
  } catch (e) {
    console.error('💥 Error during shutdown:', e);
    process.exit(1);
  }
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));