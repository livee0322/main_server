// ✅ 환경변수 로드
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ✅ user 라우터 임포트
const userRoutes = require('./routes/user');

const app = express();
const port = process.env.PORT || 3000;

// ✅ 미들웨어
app.use(cors());
app.use(express.json());

// ✅ MongoDB 연결
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ✅ 라우터 연결 (경로: /signup 등 → 직접 사용 가능)
app.use('/', userRoutes);  // 🟣 여기 경로 수정됨!

// ✅ 기본 라우터
app.get('/', (req, res) => {
  res.send('✅ Livee Main Server is running!');
});

// ✅ 서버 시작
app.listen(port, () => {
  console.log(`✅ Server is listening on port ${port}`);
});