const jwt = require("jsonwebtoken")

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization

    // Authorization 헤더가 없거나 'Bearer '로 시작하지 않으면 통과
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next()
    }

    const token = authHeader.split(" ")[1]

    try {
        // 토큰이 유효하면 사용자 정보를 req.user에 담기
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
    } catch (err) {
        // 토큰이 유효하지 않아도 에러를 발생시키지 않고 통과
    }

    next()
}
