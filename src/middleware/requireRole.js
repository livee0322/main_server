module.exports =
    (...roles) =>
    (req, res, next) => {
        if (!req.user?.role) return res.fail("AUTH_NO_ROLE", 403)
        if (!roles.includes(req.user.role) && req.user.role !== "admin") {
            return res.fail("AUTH_FORBIDDEN_ROLE", 403)
        }
        next()
    }
