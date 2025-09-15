const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const auth = require("../src/middleware/auth")

const router = express.Router()

// JWT 토큰 생성에 사용될 비밀 키와 비밀번호 암호화 강도를 설정
const JWT_SECRET = process.env.JWT_SECRET
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10)

/**
 * @route   POST /api/v1/users/signup
 * @desc    역할('brand', 'showhost')에 따라 다른 정보를 받아 사용자를 생성(회원가입)
 * @access  Public
 */
router.post("/signup", async (req, res) => {
    try {
        // 요청 본문(body)에서 회원가입에 필요한 모든 정보를 추출
        let {
            name,
            email,
            password,
            role,
            phone,
            brandName,
            companyName,
            businessNumber, // brand용
            nickname,
            snsLink,
            introduction, // showhost용
        } = req.body || {}

        // 입력값의 앞뒤 공백을 제거하고 기본 유효성을 검사
        name = (name || "").trim()
        email = (email || "").trim().toLowerCase()
        password = password || ""
        role = (role || "").trim()

        if (!name || !email || !password || !role) {
            return res.fail("VALIDATION_MISSING_FIELDS", 400)
        }
        if (!["brand", "showhost"].includes(role)) {
            return res.fail("VALIDATION_INVALID_ROLE", 400)
        }

        // 'brand' 역할의 경우, 'brandName' 필드가 필수임을 확인
        if (role === "brand" && !(brandName || "").trim()) {
            return res.fail("VALIDATION_MISSING_FIELDS", 400, {
                userMessage: "브랜드 이름은 필수 입력 항목입니다.",
            })
        }

        // 동일한 이메일로 가입된 사용자가 있는지 확인
        const exists = await User.findOne({ email })
        if (exists) {
            return res.fail("DUPLICATE", 409)
        }

        // 비밀번호를 해시하여 암호화
        const hash = await bcrypt.hash(password, SALT_ROUNDS)

        // 데이터베이스에 저장할 사용자 객체를 생성
        const userData = {
            name,
            email,
            password: hash,
            role,
            phone: (phone || "").trim(),
        }

        // 역할에 따라 해당 역할 전용 정보를 userData 객체에 추가
        if (role === "brand") {
            userData.brandName = (brandName || "").trim()
            userData.companyName = (companyName || "").trim()
            userData.businessNumber = (businessNumber || "").trim()
        } else {
            // role === 'showhost'
            userData.nickname = (nickname || "").trim()
            userData.snsLink = (snsLink || "").trim()
            userData.introduction = (introduction || "").trim()
        }

        // 완성된 사용자 정보를 데이터베이스에 저장
        const user = await User.create(userData)

        // 성공 응답을 반환
        return res
            .status(201)
            .json({ ok: true, userId: user._id.toString(), role: user.role })
    } catch (err) {
        // 에러 발생 시 로그를 기록하고 서버 에러 응답을 보내기
        console.error("signup error:", err)
        return res.fail("INTERNAL_ERROR", 500)
    }
})

/**
 * @route   POST /api/v1/users/login
 * @desc    이메일, 비밀번호, 역할을 받아 로그인 처리 후 JWT 토큰을 발급합니다.
 * @access  Public
 */
router.post("/login", async (req, res) => {
    try {
        // 요청 본문에서 이메일, 비밀번호, 역할을 추출합니다.
        let { email, password, role } = req.body || {}
        email = (email || "").trim().toLowerCase()
        password = password || ""

        // 필수 입력값이 모두 있는지 확인합니다.
        if (!email || !password || !role) {
            return res.fail("VALIDATION_MISSING_FIELDS", 400)
        }

        // 이메일로 사용자를 찾습니다.
        const user = await User.findOne({ email })
        if (!user) {
            return res.fail("INVALID_CREDENTIALS", 401)
        }

        // 요청된 역할과 실제 사용자 역할이 일치하는지 확인합니다.
        if (user.role !== role) {
            return res.fail("ROLE_MISMATCH", 401)
        }

        // 입력된 비밀번호와 저장된 해시 비밀번호를 비교합니다.
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.fail("INVALID_CREDENTIALS", 401)
        }

        // 로그인이 성공하면 JWT 토큰을 생성합니다.
        const token = jwt.sign(
            { id: user._id.toString(), role: user.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        )

        // 성공 응답과 함께 토큰을 반환합니다.
        return res
            .status(200)
            .json({ ok: true, token, name: user.name, role: user.role })
    } catch (err) {
        // 에러 발생 시 로그를 기록하고 서버 에러 응답을 보냅니다.
        console.error("login error:", err)
        return res.fail("INTERNAL_ERROR", 500)
    }
})

/**
 * @route   GET /api/v1/users/me
 * @desc    JWT 토큰을 검증하여 현재 로그인된 사용자의 기본 정보를 조회합니다.
 * @access  Private
 */
router.get("/me", auth, async (req, res) => {
    try {
        // auth 미들웨어를 통해 얻은 사용자 ID로 DB에서 정보를 조회합니다.
        const u = await User.findById(req.user.id).select("_id name role")
        if (!u) return res.fail("NOT_FOUND", 404)

        // 사용자의 기본 정보를 응답으로 보냅니다.
        return res.json({
            ok: true,
            id: u._id.toString(),
            name: u.name,
            role: u.role,
        })
    } catch (err) {
        // 에러 발생 시 로그를 기록하고 서버 에러 응답을 보냅니다.
        console.error("me error:", err)
        return res.fail("INTERNAL_ERROR", 500)
    }
})

module.exports = router
