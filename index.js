const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const userRoutes = require('./routes/user');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// 라우터 등록
app.use('/', userRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('✅ Livee Main Server is running!');
});

app.listen(port, () => {
  console.log(`✅ Server is listening on port ${port}`);
});