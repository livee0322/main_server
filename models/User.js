const mongoose = require("mongoose")

// 사용자 정보의 데이터베이스 구조(스키마)를 정의
const userSchema = new mongoose.Schema(
    {
        // --- 기본 필수 정보 ---
        name: { type: String, required: true }, // 사용자의 실명
        email: { type: String, required: true, unique: true, index: true }, // 로그인에 사용될 이메일 (중복 불가)
        password: { type: String, required: true }, // 암호화하여 저장될 비밀번호
        role: { type: String, required: true, enum: ["brand", "showhost"] }, // 사용자 역할 ('brand' 또는 'showhost')

        // --- 공통 선택 정보 ---
        phone: { type: String, trim: true }, // 사용자의 연락처

        // --- 'brand' 역할 전용 정보 ---
        brandName: { type: String, trim: true }, // 브랜드명 (필수)
        companyName: { type: String, trim: true }, // 회사명 (선택)
        businessNumber: { type: String, trim: true }, // 사업자등록번호 (선택)

        // --- 'showhost' 역할 전용 정보 ---
        nickname: { type: String, trim: true }, // 쇼호스트 활동명 (선택)
        snsLink: { type: String, trim: true }, // 대표 SNS 링크 (선택)
        introduction: { type: String }, // 자기소개 (선택)
    },
    { timestamps: true }
) // createdAt, updatedAt 타임스탬프 자동 생성을 설정

// 'User'라는 이름의 모델을 생성하며, 실제 MongoDB에서는 'users-dev' 컬렉션을 사용하도록 지정
module.exports = mongoose.model("User", userSchema, "users-dev")
