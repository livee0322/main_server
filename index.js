// index.js (refined & robust with fixes)
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
app.options('*', cors({
  credentials: CORS_CREDENTIALS,
  origin: ORIGINS.includes('*') ? '*' : ORIGINS
}));
app.use(express.json({ limit: JSON_LIMIT }));

/* ====== CORS Error Handler ====== */
app.use((err, _req, res, next) => {
  if (err && String(err.message || '').startsWith('CORS blocked:')) {
    return res.status(403).json({ ok:false, code:'CORS_BLOCKED', message: err.message });
  }
  return next(err);
});

/* ====== Response helpers ====== */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
  res.fail = (message = '요청을 처리할 수 없습니다.', code = 'INTERNAL_ERROR', status = 400, extra = {}) =>
    res.status(status).json({ ok: false, code, message, ...extra });
  next();
});

/* ====== MongoDB ====== */
const MONGO_URI = process.env.MONGO_URI;
const MONGO_OPTS = {
  autoIndex: true,
  serverSelectionTimeoutMS: 10000, // 클러스터 선택 타임아웃
  socketTimeoutMS: 45000,          // 소켓 타임아웃
  maxPoolSize: 10,
};

mongoose.set('strictQuery', true);

const MAX_RETRY   = Infinity; // 무한 재시도
const BASE_DELAY  = Number(process.env.MONGO_BASE_DELAY_MS ?? 2000); // 2s
const JITTER_MS   = 500;

async function connectWithRetry(attempt = 1) {
  try {
    await mongoose.connect(MONGO_URI, MONGO_OPTS);
    console.log('✅ MongoDB connected');
    console.log('Mongoose', mongoose.version);
    console.log('MongoDB driver', require('mongodb/package.json').version);
  } catch (err) {
    const next = Math.min(
      BASE_DELAY * Math.pow(2, attempt - 1) + Math.floor(Math.random() * JITTER_MS),
      60_000 // 최대 60초
    );
    console.error(`❌ Mongo connect error (attempt ${attempt}):`, err.message);
    console.log(`⏳ retrying in ${Math.round(next / 1000)}s...`);
    setTimeout(() => connectWithRetry(attempt + 1), next);
  }
}

if (!MONGO_URI) {
  console.warn('⚠️  MONGO_URI 미설정. DB 연결을 건너뜁니다 (/readyz는 NOT_READY 반환).');
} else {
  connectWithRetry();
}

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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🛑 MongoDB connection closed');
    }
    process.exit(0);
  } catch (e) {
    console.error('💥 Shutdown error:', e);
    process.exit(1);
  }
};
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => shutdown(sig)));