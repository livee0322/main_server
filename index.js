// index.js (refined & robust)
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* ====== Config ====== */
const BASE_PATH  = process.env.API_BASE_PATH || '/api/v1';
const PORT       = Number(process.env.PORT || 8080);
const JSON_LIMIT = process.env.JSON_LIMIT || '1mb';

// CORS: 콤마 구분, 와일드카드(*), 정규식(/.../) 모두 허용
const parseOrigins = (raw) => {
  if (!raw) return ['*'];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(v => {
      if (v === '*') return '*';
      if (v.startsWith('/') && v.endsWith('/')) {
        try { return new RegExp(v.slice(1, -1)); } catch { return v; }
      }
      return v;
    });
};
const ORIGINS = parseOrigins(process.env.CORS_ORIGIN || '*');
const CORS_CREDENTIALS = /^true$/i.test(process.env.CORS_CREDENTIALS || 'true');

app.set('trust proxy', true);

/* ====== Middlewares ====== */
app.use(cors({
  credentials: CORS_CREDENTIALS,
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl
    if (ORIGINS.includes('*')) return cb(null, true);
    const ok = ORIGINS.some(o => (o instanceof RegExp ? o.test(origin) : o === origin));
    cb(ok ? null : new Error(`CORS blocked: ${origin}`), ok);
  },
}));
app.use(express.json({ limit: JSON_LIMIT }));

/* ====== Response helpers ====== */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

/* ====== MongoDB ====== */
/* ====== DB (Mongoose 7 + Node Driver 5) ====== */
if (!process.env.MONGO_URI) {
  console.warn('⚠️  MONGO_URI 가 설정되지 않았습니다. Render의 Environment Variables를 확인하세요.');
}

const MONGO_URI = process.env.MONGO_URI;
const MONGO_OPTS = {
  autoIndex: true,
  // 최신 드라이버에서 keepAlive/keepAliveInitialDelay 제거됨
  serverSelectionTimeoutMS: 10000, // 클러스터 선택 타임아웃
  socketTimeoutMS: 45000,          // 소켓 타임아웃
  maxPoolSize: 10,                 // 커넥션 풀
  // 필요시: connectTimeoutMS: 20000,
};

mongoose.set('strictQuery', true);

const MAX_RETRY   = Number(process.env.MONGO_MAX_RETRY ?? 10);
const BASE_DELAY  = Number(process.env.MONGO_BASE_DELAY_MS ?? 2000); // 2s
const JITTER_MS   = 500;

async function connectWithRetry(attempt = 1) {
  try {
    await mongoose.connect(MONGO_URI, MONGO_OPTS);
    console.log('✅ MongoDB connected');
  } catch (err) {
    const next = Math.min(
      BASE_DELAY * Math.pow(2, attempt - 1) + Math.floor(Math.random() * JITTER_MS),
      60_000 // 최대 60초
    );
    console.error(`❌ Mongo connect error (attempt ${attempt}):`, err.message);
    if (attempt >= MAX_RETRY) {
      console.error('💥 Reached max retry attempts. Exiting.');
      process.exit(1);
      return;
    }
    console.log(`⏳ retrying in ${Math.round(next / 1000)}s...`);
    setTimeout(() => connectWithRetry(attempt + 1), next);
  }
}

connectWithRetry();

mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('🔁 MongoDB reconnected'));
mongoose.connection.on('error', (e) => console.error('🛑 Mongo error:', e.message));

/* ====== Health & Meta ====== */
const stateName = (s) => ({0:'disconnected',1:'connected',2:'connecting',3:'disconnecting'}[s] || String(s));
app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));
app.get('/healthz', (_req, res) => res.ok({ uptime: process.uptime() }));
app.get('/readyz',  (_req, res) => {
  const s = mongoose.connection.readyState; // 1=connected
  if (s === 1) return res.ok({ db: stateName(s) });
  return res.fail('DB not ready', 'NOT_READY', 503, { dbState: s, dbStateName: stateName(s) });
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

// 구버전 호환(필요 시 유지)
app.use('/api/auth',      userRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/recruit',   recruitRouter);

/* ====== 404 ====== */
app.use((req, res, _next) => {
  if (req.path === '/' || req.path.startsWith(BASE_PATH)) {
    return res.fail('리소스를 찾을 수 없습니다.', 'NOT_FOUND', 404, { path: req.path });
  }
  return res.status(404).send('Not Found');
});

/* ====== Error Handler ====== */
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