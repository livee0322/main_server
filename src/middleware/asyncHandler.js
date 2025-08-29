// 비동기 함수를 위한 에러 핸들링 래퍼(wrapper)
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next) // 에러가 발생하면 Express 에러 핸들러로 전달

module.exports = asyncHandler
