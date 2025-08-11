module.exports = (...roles) => (req, res, next) => {
  if (!req.user?.role) return res.fail('권한 없음', 'AUTH_NO_ROLE', 403);
  if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
    return res.fail('권한이 없습니다.', 'AUTH_FORBIDDEN_ROLE', 403);
  }
  next();
};
