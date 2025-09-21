// index.js
require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const swaggerUi = require("swagger-ui-express")
const swaggerSpec = require("./swaggerDef")
const errorMessages = require("./src/utils/errorMessages")

// 추가: 부팅시 에러 원인 로깅
process.on("unhandledRejection", (e) => console.error("UNHANDLED", e))
process.on("uncaughtException", (e) => console.error("UNCAUGHT", e))

const app = express()

/* ===== 기본 설정 ===== */
const BASE_PATH = process.env.API_BASE_PATH || "/api/v1"
const JSON_LIMIT = process.env.JSON_LIMIT || "1mb"
app.use(cors())
app.use(express.json({ limit: JSON_LIMIT }))

/* ===== Swagger (prod 비활성) ===== */
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  console.log("✅ Swagger API docs at /api-docs")
}

/* ===== MongoDB ===== */
if (!process.env.MONGO_URI) {
  console.warn("⚠️ MONGO_URI 미설정 (Render 환경변수 확인)")
}
mongoose.set("strictQuery", true)

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    })
    console.log("✅ MongoDB connected")
  } catch (err) {
    console.error("❌ MongoDB connect error:", err.message)
    setTimeout(connectDB, 5000)
  }
}
connectDB()
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. 재연결 시도…")
  connectDB()
})
mongoose.connection.on("reconnected", () => console.log("🔁 MongoDB reconnected"))

/* ===== 응답 헬퍼 ===== */
app.use((req, res, next) => {
  res.ok = (data = {}, status = 200) => res.status(status).json({ ok: true, ...data })
  res.fail = (code = "INTERNAL_ERROR", status = 400, extra = {}) => {
    const info = errorMessages[code] || errorMessages.INTERNAL_ERROR
    return res.status(Number(status) || 500).json({
      ok: false,
      code,
      message: info.message,
      userMessage: info.userMessage,
      ...extra,
    })
  }
  next()
})

/* ===== 라우터 ===== */
app.use(`${BASE_PATH}/uploads`, require("./routes/uploads"))
app.use(`${BASE_PATH}/users`, require("./routes/user"))
app.use(`${BASE_PATH}/portfolios`, require("./routes/portfolio"))
app.use(`${BASE_PATH}/campaigns`, require("./routes/campaigns")) // ✅ 백틱 제거
app.use(`${BASE_PATH}/applications`, require("./routes/applications"))
app.use(`${BASE_PATH}/scrape`, require("./routes/scrape"))
app.use(`${BASE_PATH}/track`, require("./routes/track"))
app.use(`${BASE_PATH}/clips`, require("./routes/clips"));
app.use(`${BASE_PATH}/models`, require("./routes/models"));

// 구버전 호환
app.use("/api/auth", require("./routes/user"))
app.use("/api/portfolio", require("./routes/portfolio"))

// test 라우터
app.use(`${BASE_PATH}/recruit-test`, require("./routes/recruit-test"))
app.use(`${BASE_PATH}/news-test`, require("./routes/news-test"))
app.use(`${BASE_PATH}/portfolio-test`, require("./routes/portfolio-test"))
app.use(`${BASE_PATH}/applications-test`, require("./routes/applications-test"))
app.use(`${BASE_PATH}/shorts-test`, require("./routes/shorts-test"))
app.use(`${BASE_PATH}/brand-test`, require("./routes/brand-test"))
app.use(`${BASE_PATH}/model-test`, require("./routes/model-test"));

;(async () => {
  try {
    const exists = await mongoose.connection.db
      .collection("portfolios")
      .indexExists("user_1")
    if (exists) {
      await mongoose.connection.db.collection("portfolios").dropIndex("user_1")
      console.log("[migrate] dropped legacy unique index user_1")
    }
  } catch (e) {
    console.warn("[migrate] drop user_1 skipped:", e.message)
  }
})()

/* ===== 헬스체크 ===== */
const stateName = (s) =>
  ({ 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }[s] || String(s))

app.get("/", (_req, res) => res.send("✅ Livee Main Server is running!"))

app.get("/healthz", (_req, res) => {
  const dbState = mongoose.connection.readyState
  res.ok({ dbState, dbStateName: stateName(dbState), uptime: process.uptime() })
})

app.get("/readyz", (_req, res) => {
  const dbState = mongoose.connection.readyState
  if (dbState === 1) return res.ok({ db: "connected" })
  return res.fail("NOT_READY", 503, { dbState, dbStateName: stateName(dbState) }) // ✅ 순서/상태코드 OK
})

/* ===== 404 ===== */
app.use((req, res, _next) => {
  if (req.path === "/" || req.path.startsWith(BASE_PATH)) {
    return res.fail("NOT_FOUND", 404, { path: req.path }) // ✅ 순서 OK
  }
  return res.status(404).send("Not Found")
})

/* ===== 에러 핸들러 ===== */
app.use((err, _req, res, _next) => {
  console.error("🔥 Unhandled Error:", err)
  let code = err.code || "INTERNAL_ERROR"
  if (err.code === 11000) code = "ALREADY_APPLIED"
  return res.fail(code, err.status || 500)
})

/* ===== 서버 시작 ===== */
const port = process.env.PORT || 8080
app.listen(port, () => console.log(`✅ Server listening on ${port} (base: ${BASE_PATH})`))