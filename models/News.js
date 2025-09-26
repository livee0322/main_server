const mongoose = require("mongoose")

// '뉴스(공지사항)' 정보의 데이터베이스 구조(스키마)를 정의
const newsSchema = new mongoose.Schema(
    {
        // 게시물 제목 (필수)
        title: { type: String, required: true, trim: true },
        // 게시물 내용 (필수)
        content: { type: String, required: true },
        // 대표 이미지 URL (선택)
        imageUrl: { type: String, trim: true },
        // 게시물을 생성한 사용자 ID (쇼호스트 역할의 사용자)
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    {
        // createdAt, updatedAt 타임스탬프 자동 생성을 설정
        timestamps: true,
    }
)

// 'News'라는 이름의 모델을 생성하며, 실제 MongoDB에서는 'news-dev' 컬렉션을 사용하도록 지정
module.exports = mongoose.model("News", newsSchema, "news-dev")
