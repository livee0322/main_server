const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const auth = require("../src/middleware/auth")

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10)

router.post("/signup", async (req, res) => {
    try {
        let { name, email, password, role } = req.body || {}
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

        const exists = await User.findOne({ email })
        if (exists) {
            return res.fail("DUPLICATE", 409)
        }

        const hash = await bcrypt.hash(password, SALT_ROUNDS)
        const user = await User.create({ name, email, password: hash, role })

        return res
            .status(201)
            .json({ ok: true, userId: user._id.toString(), role: user.role })
    } catch (err) {
        console.error("signup error:", err)
        return res.fail("INTERNAL_ERROR", 500)
    }
})

router.post("/login", async (req, res) => {
    try {
        let { email, password, role } = req.body || {}
        email = (email || "").trim().toLowerCase()
        password = password || ""

        if (!email || !password || !role) {
            return res.fail("VALIDATION_MISSING_FIELDS", 400)
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.fail("INVALID_CREDENTIALS", 401)
        }

        if (user.role !== role) {
            return res.fail("ROLE_MISMATCH", 401)
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.fail("INVALID_CREDENTIALS", 401)
        }

        const token = jwt.sign(
            { id: user._id.toString(), role: user.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        )

        return res
            .status(200)
            .json({ ok: true, token, name: user.name, role: user.role })
    } catch (err) {
        console.error("login error:", err)
        return res.fail("INTERNAL_ERROR", 500)
    }
})

router.get("/me", auth, async (req, res) => {
    try {
        const u = await User.findById(req.user.id).select("_id name role")
        if (!u) return res.fail("NOT_FOUND", 404)
        return res.json({
            ok: true,
            id: u._id.toString(),
            name: u.name,
            role: u.role,
        })
    } catch (err) {
        console.error("me error:", err)
        return res.fail("INTERNAL_ERROR", 500)
    }
})

module.exports = router
