// index.js (stable + reconnect + campaigns suite)
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

/* ===== 기본 설정 ===== */
const BASE_PATH  = process.env.API_BASE_PATH || '/api/v1';
const JSON_LIMIT = process.env.JSON_LIMIT || '1mb';
app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));

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
      maxPoolSize: 10,
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

/* ===== 라우터 (기존) ===== */
app.use(`${BASE_PATH}/uploads`,    require('./routes/uploads'));
app.use(`${BASE_PATH}/users`,      require('./routes/user'));
app.use(`${BASE_PATH}/portfolios`, require('./routes/portfolio'));
app.use(`${BASE_PATH}/recruits`,   require('./routes/recruit')); // 기존 엔드포인트 유지

// 구버전 호환
app.use('/api/auth',      require('./routes/user'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/recruit',   require('./routes/recruit'));

/* ===== 라우터 (신규 캠페인 스위트) =====
   - /campaigns : 캠페인 CRUD (product/recruit 통합)
   - /campaigns/:cid/applications : 지원서
   - /scrape/product?url=... : 오픈마켓 메타 스크랩
   - /t/:cid, /px.gif : 클릭/뷰 트래킹
   - /recruits (compat): 기존 프론트의 /recruits 호출을 캠페인 recruit로 매핑
*/
app.use(`${BASE_PATH}/campaigns`,    require('./routes/campaigns'));
app.use(`${BASE_PATH}`,              require('./routes/applications')); // 내부에서 /campaigns/:cid/applications, /applications/:id
app.use(`${BASE_PATH}/scrape`,       require('./routes/scrape'));
app.use(`${BASE_PATH}`,              require('./routes/track'));
app.use(`${BASE_PATH}/recruits`,     require('./routes/recruits-compat')); // 호환 레이어

/* ===== 헬스체크 ===== */
const stateName = (s) => ({0:'disconnected',1:'connected',2:'connecting',3:'disconnecting'}[s] || String(s));

app.get('/', (_req, res) => res.send('✅ Livee Main Server is running!'));

app.get('/healthz', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  res.ok({ dbState, dbStateName: stateName(dbState), uptime: process.uptime() });
});

app.get('/readyz', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) return res.ok({ db: 'connected' });
  return res.fail('DB not ready', 'NOT_READY', 503, { dbState, dbStateName: stateName(dbState) });
});

/* ===== 404 ===== */
app.use((req, res, _next) => {
  if (req.path === '/' || req.path.startsWith(BASE_PATH)) {
    return res.fail('리소스를 찾을 수 없습니다.', 'NOT_FOUND', 404, { path: req.path });
  }
  return res.status(404).send('Not Found');
});

/* ===== 에러 핸들러 ===== */
app.use((err, _req, res, _next) => {
  console.error('🔥 Unhandled Error:', err);
  res.fail(err.message || '서버 오류', err.code || 'INTERNAL_ERROR', err.status || 500);
});

/* ===== 서버 시작 ===== */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Server listening on ${port} (base: ${BASE_PATH})`));