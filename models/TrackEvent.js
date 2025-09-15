const mongoose = require("mongoose")

const TrackEventSchema = new mongoose.Schema(
    {
        type: { type: String, default: "scrape" }, // ex) 'scrape', 'campaign', ...
        url: String,
        vendor: String, // ex) 'naver', 'coupang'
        ok: Boolean, // 성공/실패
        message: String, // 에러 메시지 등
        meta: mongoose.Schema.Types.Mixed, // 응답 요약/추가 정보
    },
    { timestamps: true }
)

module.exports = mongoose.model(
    "TrackEvent",
    TrackEventSchema,
    "trackevents-dev"
)
