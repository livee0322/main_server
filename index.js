// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const userRoutes = require('./routes/user');

const app = express();
const port = process.env.PORT || 3000;

// ✅ Middleware
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

// ✅ 라우터 연결 (경로: /api/auth)
app.use('/api/auth', userRoutes);

// ✅ 기본 라우터
app.get('/', (req, res) => {
  res.send('✅ Livee Main Server is running!');
});

app.listen(port, () => {
  console.log(`✅ Server is listening on port ${port}`);
});