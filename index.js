// ✅ 환경변수 로드
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ✅ 포트는 반드시 Render에서 주는 process.env.PORT만 사용해야 함
const port = process.env.PORT;

// ✅ 미들웨어
app.use(cors());
app.use(express.json());

// ✅ MongoDB 연결
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ✅ 라우터 임포트 (경로 정확히 확인)
const userRoutes = require('./routes/user');           // 회원가입, 로그인
const portfolioRoutes = require('./routes/portfolio'); // 포트폴리오 관련
const recruitRoutes = require('./routes/recruit');     // 모집공고 관련

// ✅ 라우터 등록
app.use('/api/auth', userRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/recruit', recruitRoutes);

// ✅ 기본 라우트 확인용
app.get('/', (req, res) => {
  res.send('✅ Livee Main Server is running!');
});

// ✅ 서버 시작
app.listen(port, () => {
  console.log(`✅ Server is listening on port ${port}`);
});