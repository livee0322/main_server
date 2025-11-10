// swaggerDef.js
const swaggerJsdoc = require("swagger-jsdoc")

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Livee API Server",
            version: "1.0.0",
            description: "Livee 서비스의 API 명세서입니다.",
        },
        servers: [
            {
                url: "/api/v1",
                description: "메인 API 서버",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description:
                        '로그인 후 발급받은 JWT 토큰을 "Bearer {token}" 형식으로 입력하세요.',
                },
            },
        },
        tags: [
            { name: "Users", description: "사용자 인증 및 정보" },
            { name: "Campaigns", description: "캠페인 관리" },
            { name: "Applications", description: "캠페인 지원서 관리" },
            { name: "Portfolios", description: "쇼호스트 포트폴리오" },
            { name: "Proposals", description: "섭외 제안" },
            { name: "Models", description: "모델 프로필" },
            { name: "Clips", description: "숏클립 관리" },
            { name: "News", description: "뉴스/공지사항" },
            { name: "Studios", description: "스튜디오 정보" },
            { name: "Uploads", description: "파일 업로드" },
            { name: "Scrape", description: "외부 URL 정보 스크래핑" },
            { name: "Tracking", description: "사용자 행동 트래킹" },
            {
                name: "Recruits (Compat)",
                description: "구버전 호환용 공고 API",
            },
        ],
        paths: {
            // ===== Users =====
            "/users/signup": {
                post: {
                    summary: "사용자 회원가입",
                    tags: ["Users"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        name: {
                                            type: "string",
                                            example: "라이비",
                                        },
                                        email: {
                                            type: "string",
                                            example: "brand@example.com",
                                        },
                                        password: {
                                            type: "string",
                                            example: "password123",
                                        },
                                        role: {
                                            type: "string",
                                            enum: ["brand", "showhost"],
                                            example: "brand",
                                        },
                                        // 'brand' 역할일 경우 추가 필드
                                        brandName: { 
                                            type: "string", 
                                            example: "나이키" 
                                        },
                                    },
                                    required: ["name", "email", "password", "role"]
                                },
                            },
                        },
                    },
                    responses: { 
                        201: { description: "회원가입 성공" },
                        400: { description: "유효성 오류" },
                        409: { description: "이메일 중복" }
                    },
                },
            },
            "/users/login": {
                post: {
                    summary: "사용자 로그인",
                    tags: ["Users"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        email: {
                                            type: "string",
                                            example: "brand@example.com",
                                        },
                                        password: {
                                            type: "string",
                                            example: "password123",
                                        },
                                        role: {
                                            type: "string",
                                            enum: ["brand", "showhost"],
                                            example: "brand",
                                        },
                                    },
                                    required: ["email", "password", "role"]
                                },
                            },
                        },
                    },
                    responses: { 
                        200: { description: "로그인 성공" },
                        401: { description: "인증 실패" }
                    },
                },
            },
            "/users/me": {
                get: {
                    summary: "내 정보 조회",
                    tags: ["Users"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "조회 성공" },
                        401: { description: "인증 실패" },
                        404: { description: "사용자 없음" }
                    },
                },
            },
            // ===== Campaigns =====
            "/campaigns": {
                get: {
                    summary: "캠페인 목록 조회 (검색/정렬/페이지네이션)",
                    tags: ["Campaigns"],
                    parameters: [
                        {
                            name: "search",
                            in: "query",
                            description: "검색어",
                            schema: { type: "string" },
                        },
                        {
                            name: "sort",
                            in: "query",
                            description: "정렬 (latest, deadline)",
                            schema: {
                                type: "string",
                                enum: ["latest", "deadline"],
                                default: "latest",
                            },
                        },
                        {
                            name: "page",
                            in: "query",
                            schema: { type: "integer", default: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            schema: { type: "integer", default: 10 },
                        },
                    ],
                    responses: {
                        200: {
                            description: "조회 성공",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            items: {
                                                type: "array",
                                                items: { type: "object" },
                                            },
                                            currentPage: { type: "integer" },
                                            totalPages: { type: "integer" },
                                            totalItems: { type: "integer" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                post: {
                    summary: "캠페인 생성",
                    tags: ["Campaigns"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        description: "캠페인 생성에 필요한 정보 (Campaign 스키마 참조)",
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string" },
                                        brandName: { type: "string" },
                                        shootDate: { type: "string", format: "date-time" },
                                        closeAt: { type: "string", format: "date-time" },
                                        durationHours: { type: "number" },
                                        startTime: { type: "string" },
                                        endTime: { type: "string" },
                                    },
                                    required: ["title", "brandName", "shootDate", "closeAt", "durationHours", "startTime", "endTime"]
                                },
                            },
                        },
                    },
                    responses: { 
                        201: { description: "생성 성공" },
                        422: { description: "유효성 검사 실패" }
                    },
                },
            },
            "/campaigns/mine": {
                get: {
                    summary: "내가 만든 캠페인 조회",
                    tags: ["Campaigns"],
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: "조회 성공" } },
                },
            },
            "/campaigns/meta": {
                get: {
                    summary: "캠페인 메타데이터 조회",
                    tags: ["Campaigns"],
                    description: "캠페인 생성/검색에 필요한 카테고리, 브랜드 목록 등을 제공합니다.",
                    responses: { 200: { description: "조회 성공" } },
                },
            },
            "/campaigns/{id}": {
                get: {
                    summary: "캠페인 상세 조회",
                    tags: ["Campaigns"],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        200: { description: "조회 성공" },
                        404: { description: "캠페인 없음" },
                        400: { description: "Invalid ID" }
                    },
                },
                put: {
                    summary: "캠페인 수정",
                    tags: ["Campaigns"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/json": { schema: { type: "object" } },
                        },
                    },
                    responses: {
                        200: { description: "수정 성공" },
                        403: { description: "권한 없음" },
                        400: { description: "게시 상태 변경 시 커버 이미지 필요" }
                    },
                },
                delete: {
                    summary: "캠페인 삭제 (isPublic: false로 변경)",
                    tags: ["Campaigns"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        200: { description: "삭제 성공" },
                        403: { description: "권한 없음" },
                    },
                },
            },
            // ===== Applications =====
            "/applications": {
                get: {
                    summary: "캠페인 지원자 목록 조회 (소유자)",
                    tags: ["Applications"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "campaignId",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        200: { description: "조회 성공" },
                        403: { description: "권한 없음" },
                        404: { description: "캠페인 없음" }
                    },
                },
                post: {
                    summary: "캠페인 지원서 제출",
                    tags: ["Applications"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        campaignId: { type: "string" },
                                        profileRef: { type: "string" },
                                        message: { type: "string" },
                                    },
                                    required: ["campaignId"]
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: "제출 성공" },
                        409: { description: "이미 지원함" },
                        404: { description: "캠페인 없음" },
                        400: { description: "모집형 캠페인이 아님" }
                    },
                },
            },
            "/applications/mine": {
                get: {
                    summary: "내 지원 현황 조회",
                    tags: ["Applications"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "campaignId",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: { 
                        200: { description: "조회 성공 (data: null 이면 미지원)" },
                        422: { description: "campaignId 누락" }
                    },
                },
            },
            "/applications/{id}": {
                patch: {
                    summary: "지원서 상태 변경 (소유자)",
                    tags: ["Applications"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: {
                                            type: "string",
                                            enum: [
                                                "submitted",
                                                "reviewing",
                                                "shortlisted",
                                                "accepted",
                                                "rejected",
                                            ],
                                        },
                                    },
                                    required: ["status"]
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "변경 성공" },
                        403: { description: "권한 없음" },
                        404: { description: "지원서 또는 캠페인 없음" }
                    },
                },
            },
            // ===== Portfolios =====
            "/portfolios": {
                get: {
                    summary: "공개 포트폴리오 목록 조회",
                    tags: ["Portfolios"],
                    parameters: [
                        {
                            name: "page",
                            in: "query",
                            schema: { type: "integer", default: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            schema: { type: "integer", default: 20 },
                        },
                    ],
                    responses: { 200: { description: "조회 성공" } },
                },
                post: {
                    summary: "내 포트폴리오 생성 (신규)",
                    tags: ["Portfolios"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        nickname: { type: "string" },
                                        oneLineIntro: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { 201: { description: "생성 성공" } },
                },
            },
            "/portfolios/my/list": {
                get: {
                    summary: "내 모든 포트폴리오 목록 조회 (신규)",
                    tags: ["Portfolios"],
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: "조회 성공" } },
                },
            },
            "/portfolios/{id}": {
                get: {
                    summary: "공개 포트폴리오 상세 조회",
                    tags: ["Portfolios"],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        200: { description: "조회 성공" },
                        404: { description: "포트폴리오 없음 (비공개 포함)" },
                    },
                },
                put: {
                    summary: "내 특정 포트폴리오 수정",
                    tags: ["Portfolios"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/json": { schema: { type: "object" } },
                        },
                    },
                    responses: {
                        200: { description: "수정 성공" },
                        403: { description: "권한 없음" },
                    },
                },
                delete: {
                    summary: "내 특정 포트폴리오 삭제 (신규)",
                    tags: ["Portfolios"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        200: { description: "삭제 성공" },
                        403: { description: "권한 없음" },
                    },
                },
            },
            // ===== Proposals (신규) =====
            "/proposals": {
                post: {
                    summary: "쇼호스트에게 새 섭외 제안 생성",
                    tags: ["Proposals"],
                    security: [{ bearerAuth: [] }],
                    description: "Brand 역할만 가능",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        targetPortfolioId: { type: "string", description: "대상 포트폴리오 ID" },
                                        brandName: { type: "string" },
                                        shootingDate: { type: "string", format: "date-time" },
                                        replyDeadline: { type: "string", format: "date-time" },
                                        isFeeNegotiable: { type: "boolean" },
                                        fee: { type: "number", description: "협의가 아닐 경우 금액" },
                                        content: { type: "string", description: "제안 내용" }
                                    },
                                    required: ["targetPortfolioId", "brandName", "shootingDate", "replyDeadline", "isFeeNegotiable"]
                                }
                            }
                        }
                    },
                    responses: {
                        201: { description: "제안 전송 성공" },
                        400: { description: "유효성 검사 실패" },
                        404: { description: "대상 포트폴리오 없음" }
                    }
                }
            },
            "/proposals/sent": {
                get: {
                    summary: "보낸 제안 목록 조회 (브랜드)",
                    tags: ["Proposals"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "status", in: "query", schema: { type: "string", enum: ["pending", "accepted", "rejected", "withdrawn", "hold"] } },
                        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                        { name: "limit", in: "query", schema: { type: "integer", default: 10 } }
                    ],
                    responses: { 200: { description: "조회 성공" } }
                }
            },
            "/proposals/received": {
                get: {
                    summary: "받은 제안 목록 조회 (쇼호스트)",
                    tags: ["Proposals"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "status", in: "query", schema: { type: "string", enum: ["pending", "accepted", "rejected", "withdrawn", "hold"] } },
                        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                        { name: "limit", in: "query", schema: { type: "integer", default: 10 } }
                    ],
                    responses: { 200: { description: "조회 성공" } }
                }
            },
            "/proposals/{id}/withdraw": {
                patch: {
                    summary: "보낸 제안 철회 (브랜드)",
                    tags: ["Proposals"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "철회 성공" },
                        400: { description: "철회 불가 (대기 상태 아님)" },
                        403: { description: "권한 없음" },
                        404: { description: "제안 없음" }
                    }
                }
            },
            // ===== Models (신규) =====
            "/models": {
                post: {
                    summary: "새 모델 프로필 생성",
                    tags: ["Models"],
                    security: [{ bearerAuth: [] }],
                    description: "Showhost 역할만 가능",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        nickname: { type: "string" },
                                        oneLineIntro: { type: "string" },
                                        experienceYears: { type: "number" }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 201: { description: "생성 성공" } }
                },
                get: {
                    summary: "공개된 모델 목록 조회 (페이지네이션)",
                    tags: ["Models"],
                    parameters: [
                        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                        { name: "limit", in: "query", schema: { type: "integer", default: 20 } }
                    ],
                    responses: { 200: { description: "조회 성공" } }
                }
            },
            "/models/{id}": {
                get: {
                    summary: "특정 모델 상세 정보 조회 (공개)",
                    tags: ["Models"],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "조회 성공" },
                        404: { description: "모델 없음" },
                        400: { description: "Invalid ID" }
                    }
                },
                delete: {
                    summary: "모델 프로필 삭제 (본인)",
                    tags: ["Models"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "삭제 성공" },
                        403: { description: "권한 없음" },
                        400: { description: "Invalid ID" }
                    }
                }
            },
            // ===== Clips (신규) =====
            "/clips": {
                post: {
                    summary: "새로운 숏클립 생성",
                    tags: ["Clips"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        url: { type: "string", format: "url", description: "유튜브/인스타/틱톡 URL" },
                                        title: { type: "string" },
                                        description: { type: "string" },
                                        thumbnailUrl: { type: "string", format: "url" }
                                    },
                                    required: ["url"]
                                }
                            }
                        }
                    },
                    responses: {
                        201: { description: "생성 성공" },
                        422: { description: "URL 유효성 실패" }
                    }
                },
                get: {
                    summary: "숏클립 목록 조회 (내 글 여부 포함)",
                    tags: ["Clips"],
                    description: "로그인 시(optionalAuth) isMine 필드 포함",
                    responses: { 200: { description: "조회 성공" } }
                }
            },
            "/clips/{id}": {
                delete: {
                    summary: "숏클립 삭제 (본인)",
                    tags: ["Clips"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "삭제 성공" },
                        403: { description: "권한 없음" },
                        422: { description: "Invalid ID" }
                    }
                }
            },
            // ===== News (신규) =====
            "/news": {
                get: {
                    summary: "전체 뉴스 목록 조회 (페이지네이션)",
                    tags: ["News"],
                    parameters: [
                        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                        { name: "limit", in: "query", schema: { type: "integer", default: 10 } }
                    ],
                    responses: { 200: { description: "조회 성공" } }
                },
                post: {
                    summary: "새 뉴스 생성 (Showhost)",
                    tags: ["News"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string" },
                                        content: { type: "string" },
                                        imageUrl: { type: "string", format: "url" }
                                    },
                                    required: ["title", "content"]
                                }
                            }
                        }
                    },
                    responses: { 
                        201: { description: "생성 성공" },
                        422: { description: "유효성 검사 실패" }
                    }
                }
            },
            "/news/{id}": {
                get: {
                    summary: "특정 뉴스 상세 조회",
                    tags: ["News"],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "조회 성공" },
                        404: { description: "뉴스 없음" },
                        400: { description: "Invalid ID" }
                    }
                },
                put: {
                    summary: "특정 뉴스 수정 (Showhost)",
                    tags: ["News"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string" },
                                        content: { type: "string" },
                                        imageUrl: { type: "string", format: "url" }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: "수정 성공" },
                        404: { description: "뉴스 없음" },
                        422: { description: "유효성 검사 실패" }
                    }
                },
                delete: {
                    summary: "특정 뉴스 삭제 (Showhost)",
                    tags: ["News"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "삭제 성공" },
                        404: { description: "뉴스 없음" }
                    }
                }
            },
            // ===== Studios (신규) =====
            "/studios": {
                post: {
                    summary: "새 스튜디오 정보 생성",
                    tags: ["Studios"],
                    description: "현재 인증 없음",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        brandName: { type: "string" },
                                        oneLineIntro: { type: "string" }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 201: { description: "생성 성공" } }
                }
            },
            "/studios/{id}": {
                get: {
                    summary: "스튜디오 정보 조회",
                    tags: ["Studios"],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    responses: {
                        200: { description: "조회 성공" },
                        404: { description: "스튜디오 없음" },
                        400: { description: "Invalid ID" }
                    }
                },
                put: {
                    summary: "스튜디오 정보 수정",
                    tags: ["Studios"],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } }
                    ],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: { type: "object" }
                            }
                        }
                    },
                    responses: {
                        200: { description: "수정 성공" },
                        404: { description: "스튜디오 없음" },
                        400: { description: "Invalid ID" }
                    }
                }
            },
            // ===== Uploads =====
            "/uploads/signature": {
                get: {
                    summary: "Cloudinary 업로드 서명 발급",
                    tags: ["Uploads"],
                    description: "Brand, Admin, Showhost 역할만 가능",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { 
                            name: "type", 
                            in: "query", 
                            schema: { type: "string", enum: ["image", "raw"], default: "image" }, 
                            description: "raw 타입은 이력서 등 파일 업로드용" 
                        }
                    ],
                    responses: { 
                        200: { 
                            description: "발급 성공",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            ok: { type: "boolean" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    cloudName: { type: "string" },
                                                    apiKey: { type: "string" },
                                                    timestamp: { type: "integer" },
                                                    signature: { type: "string" },
                                                    folder: { type: "string", description: "raw 타입일 경우만 포함" },
                                                    resource_type: { type: "string", description: "raw 타입일 경우만 포함" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        500: { description: "서명 생성 실패 (CLOUDINARY_URL 설정 오류)" },
                        401: { description: "인증 실패" },
                        403: { description: "권한 없음 (Brand, Admin, Showhost만 가능)" }
                    },
                },
            },
            // ===== Scrape =====
            "/scrape": {
                get: {
                    summary: "URL 정보 스크래핑",
                    tags: ["Scrape"],
                    description: "네이버, 쿠팡, 유튜브, 인스타그램, 틱톡 등 외부 URL의 메타정보(제목, 이미지, 가격 등)를 추출합니다.",
                    parameters: [
                        {
                            name: "url",
                            in: "query",
                            required: true,
                            schema: { type: "string", format: "uri" },
                            description: "스크래핑할 대상 URL"
                        },
                    ],
                    responses: {
                        200: { 
                            description: "성공",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            ok: { type: "boolean" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    vendor: { type: "string", enum: ["youtube", "naver", "coupang", "gmarket", "11st", "instagram", "tiktok", "unknown"] },
                                                    title: { type: "string" },
                                                    price: { type: "number", nullable: true },
                                                    image: { type: "string" },
                                                    raw: {
                                                        type: "object",
                                                        properties: {
                                                            description: { type: "string" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        500: { description: "스크래핑 실패" },
                        400: { description: "url 파라미터 누락" }
                    },
                },
            },
            // ===== Tracking (신규) =====
            "/track/t/{cid}": {
                get: {
                    summary: "클릭 트래킹 리디렉트",
                    tags: ["Tracking"],
                    parameters: [
                        { name: "cid", in: "path", required: true, schema: { type: "string" }, description: "캠페인 ID" },
                        { name: "to", in: "query", required: true, schema: { type: "string", format: "url" }, description: "리디렉션될 최종 URL" },
                        { name: "tag", in: "query", schema: { type: "string" }, description: "트래킹용 태그 (선택)" }
                    ],
                    responses: {
                        302: { description: "캠페인 클릭 수 증가 후 'to' URL로 리디렉트" },
                        422: { description: "'to' 쿼리 파라미터 누락" }
                    }
                }
            },
            "/track/px.gif": {
                get: {
                    summary: "1x1 뷰 트래킹 픽셀",
                    tags: ["Tracking"],
                    parameters: [
                        { name: "cid", in: "query", schema: { type: "string" }, description: "캠페인 ID" },
                        { name: "tag", in: "query", schema: { type: "string" }, description: "트래킹용 태그 (선택)" }
                    ],
                    responses: {
                        200: { description: "캠페인 뷰 증가 후 1x1 GIF 반환", content: { "image/gif": {} } }
                    }
                }
            }
        },
    },
    apis: [], // 자동 스캔 대신 수동 정의 사용
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec