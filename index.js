// index.js (refactored)
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* ====== Configs ====== */
const BASE_PATH        = process.env.API_BASE_PATH || '/api/v1';
const PORT             = process.env.PORT || 8080;
const JSON_LIMIT       = process.env.JSON_LIMIT || '1mb';
const CORS_ORIGIN      = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const CORS_CREDENTIALS = /^true$/i.test(process.env.CORS_CREDENTIALS || 'true');

app.set('trust proxy', true);

/* ====== Middlewares ====== */
app.use(cors({ origin: CORS_ORIGIN.length ? CORS_ORIGIN : '*', credentials: CORS_CREDENTIALS }));
app.use(express.json({ limit: JSON_LIMIT }));

/* 응답 헬퍼 (route 앞) */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

/* ====== DB ====== */
if (!process.env.MONGO_URI) {
  console.warn('⚠️  MONGO_URI 가 설정되지 않았습니다. Render의 Environment Variables를 확인하세요.');
}

// 권장 기본값들
mongoose.set('strictQuery', true);

mongoose.connect(process.env.MONGO_URI, {
  autoIndex: true,
  // 연결 안정성 향상 옵션들
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connect error:', err));

// 상태 로그
mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('🔁 MongoDB reconnected'));

/* ====== Health & Meta ====== */
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));
app.get('/healthz', (_req, res) => res.ok({ uptime: process.uptime() }));
app.get('/readyz',  (_req, res) => {
  const state = mongoose.connection.readyState; // 1=connected
  if (state === 1) return res.ok({ db: 'connected' });
  return res.fail('DB not ready', 'NOT_READY', 503, { dbState: state });
});
app.get('/version', (_req, res) => res.ok({
  env: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || 'dev',
}));

/* ====== Routers ====== */
const uploadsRouter   = require('./routes/uploads');
const userRouter      = require('./routes/user');
const portfolioRouter = require('./routes/portfolio');
const recruitRouter   = require('./routes/recruit');

app.use(`${BASE_PATH}/uploads`,    uploadsRouter);
app.use(`${BASE_PATH}/users`,      userRouter);
app.use(`${BASE_PATH}/portfolios`, portfolioRouter);
app.use(`${BASE_PATH}/recruits`,   recruitRouter);

// 구버전 호환(옵션 유지)
app.use('/api/auth',      userRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/recruit',   recruitRouter);

/* ====== 404 ====== */
app.use((req, res, _next) => {
  if (req.path === '/' || req.path.startsWith(BASE_PATH)) {
    return res.fail('리소스를 찾을 수 없습니다.', 'NOT_FOUND', 404, { path: req.path });
  }
  // 정적/프론트 라우팅 환경이라면 여기서 index.html 서빙하도록 변경 가능
  return res.status(404).send('Not Found');
});

/* ====== Error Handler (last) ====== */
app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled Error:', err);
  const status = err.status || 500;
  const code   = err.code   || 'INTERNAL_ERROR';
  const msg    = err.message || '서버 오류';
  res.fail(msg, code, status);
});

/* ====== Start ====== */
const server = app.listen(PORT, () => {
  console.log(`✅ Server listening on ${PORT} (base: ${BASE_PATH})`);
});

/* ====== Graceful Shutdown ====== */
const shutdown = async (sig) => {
  try {
    console.log(`\n👋 ${sig} received. Shutting down gracefully...`);
    server.close(() => console.log('🛑 HTTP server closed'));
    await mongoose.connection.close();
    console.log('🛑 MongoDB connection closed');
    process.exit(0);
  } catch (e) {
    console.error('💥 Shutdown error:', e);
    process.exit(1);
  }
};
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => shutdown(sig)));