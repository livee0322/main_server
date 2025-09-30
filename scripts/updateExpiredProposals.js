// 이 스크립트는 Render의 Cron Job 기능을 통해 주기적으로(예: 매일 자정) 실행
require("dotenv").config({ path: "../.env" }) // 프로젝트 루트의 .env 파일을 사용하도록 경로를 설정
const mongoose = require("mongoose")
const Proposal = require("../models/Proposal")

/**
 * @function run
 * @desc '답장 기한(replyDeadline)'이 지나고 상태가 'pending'인 제안을 찾아 'hold'로 변경
 */
const run = async () => {
    console.log("Running job: updateExpiredProposals...")

    try {
        // 1. MongoDB에 연결
        await mongoose.connect(process.env.MONGO_URI)
        console.log("MongoDB connected for cron job.")

        // 2. 업데이트할 조건을 설정
        const today = new Date()
        today.setHours(0, 0, 0, 0) // 오늘 날짜의 시작(자정)으로 설정

        const conditions = {
            status: "pending", // 상태가 '대기중'이고,
            replyDeadline: { $lt: today }, // '답장 기한'이 오늘 이전인 제안
        }

        // 3. 조건에 맞는 제안들을 찾아 상태를 'hold'로 업데이트
        const result = await Proposal.updateMany(conditions, {
            $set: { status: "hold" },
        })

        console.log(
            `Job finished. Found ${result.matchedCount} proposals, updated ${result.modifiedCount}.`
        )
    } catch (err) {
        console.error("Error running updateExpiredProposals job:", err)
    } finally {
        // 4. 작업이 끝나면 MongoDB 연결을 종료
        await mongoose.disconnect()
        console.log("MongoDB disconnected.")
    }
}

run()
