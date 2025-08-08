// ✅ 환경변수 로드
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS 설정 (GitHub Pages origin 명시 + credentials 허용)
app.use(
  cors({
    origin: ["https://livee0322.github.io"], // 프론트엔드 주소 명확히!
    credentials: true,                       // fetch에 credentials 옵션이 있을 경우 필요
  })
);

// ✅ 공통 미들웨어
app.use(express.json());

// ✅ MongoDB 연결
mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ 라우터 임포트 (경로 정확히)
const userRoutes = require('./routes/user');
const portfolioRoutes = require('./routes/portfolio');
const recruitRoutes = require('./routes/recruit');

// ✅ 라우터 등록
app.use('/api/auth', userRoutes);           // 회원가입, 로그인
app.use('/api/portfolio', portfolioRoutes); // 포트폴리오 등록/조회/삭제/수정
app.use('/api/recruit', recruitRoutes);     // 모집공고 등록/조회/삭제 등

// ✅ 헬스체크 라우터
app.get('/', (req, res) => {
  res.send('✅ Livee Main Server is running!');
});

// ✅ 서버 실행
app.listen(port, () => {
  console.log(`✅ Server is listening on port ${port}`);
});