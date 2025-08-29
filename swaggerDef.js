// swaggerDef.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Livee API Server',
      version: '1.0.0',
      description: 'Livee 서비스의 API 명세서입니다.',
    },
    servers: [
      {
        url: '/api/v1',
        description: '메인 API 서버',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '로그인 후 발급받은 JWT 토큰을 "Bearer {token}" 형식으로 입력하세요.',
        },
      },
    },
    tags: [
        { name: "Users", description: "사용자 인증 및 정보" },
        { name: "Campaigns", description: "캠페인 관리" },
        { name: "Applications", description: "캠페인 지원서 관리" },
        { name: "Portfolios", description: "쇼호스트 포트폴리오" },
        { name: "Recruits", description: "구인/구직 공고 (신규)" },
        { name: "Uploads", description: "파일 업로드" },
        { name: "Scrape", description: "외부 URL 정보 스크래핑" },
        { name: "Tracking", description: "사용자 행동 트래킹" },
        { name: "Recruits (Compat)", description: "구버전 호환용 공고 API" },
    ],
    paths: {
      // ===== Users =====
      '/users/signup': {
        post: {
          summary: "사용자 회원가입",
          tags: ["Users"],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: '라이비' },
                email: { type: 'string', example: 'brand@example.com' },
                password: { type: 'string', example: 'password123' },
                role: { type: 'string', enum: ['brand', 'showhost'], example: 'brand' },
              }
            }}}
          },
          responses: { '201': { description: '회원가입 성공' } }
        }
      },
      '/users/login': {
        post: {
          summary: "사용자 로그인",
          tags: ["Users"],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                email: { type: 'string', example: 'brand@example.com' },
                password: { type: 'string', example: 'password123' },
              }
            }}}
          },
          responses: { '200': { description: '로그인 성공' } }
        }
      },
      '/users/me': {
        get: {
          summary: "내 정보 조회",
          tags: ["Users"],
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: '조회 성공' }, '401': { description: '인증 실패' } }
        }
      },
      // ===== Campaigns =====
      '/campaigns': {
        get: {
          summary: "캠페인 목록 조회",
          tags: ["Campaigns"],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['product', 'recruit'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'scheduled', 'published', 'closed'] } },
          ],
          responses: { '200': { description: '조회 성공' } }
        },
        post: {
          summary: "캠페인 생성",
          tags: ["Campaigns"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            description: "캠페인 생성에 필요한 정보",
            required: true,
            content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['product', 'recruit'] },
                    title: { type: 'string' }
                }
            }}}
          },
          responses: { '201': { description: '생성 성공' } }
        }
      },
      '/campaigns/mine': {
          get: {
              summary: "내가 만든 캠페인 조회",
              tags: ["Campaigns"],
              security: [{ bearerAuth: [] }],
              responses: { '200': { description: '조회 성공' } }
          }
      },
      '/campaigns/{id}': {
        get: {
            summary: "캠페인 상세 조회",
            tags: ["Campaigns"],
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }}],
            responses: { '200': { description: '조회 성공' }, '404': { description: '캠페인 없음' } }
        },
        put: {
            summary: "캠페인 수정",
            tags: ["Campaigns"],
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }}],
            requestBody: { content: { 'application/json': { schema: { type: 'object' }}} },
            responses: { '200': { description: '수정 성공' }, '403': { description: '권한 없음' } }
        },
        delete: {
            summary: "캠페인 삭제",
            tags: ["Campaigns"],
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }}],
            responses: { '200': { description: '삭제 성공' }, '403': { description: '권한 없음' } }
        }
      },
      // ===== Applications =====
      '/applications': {
          get: {
              summary: "캠페인 지원자 목록 조회 (소유자)",
              tags: ["Applications"],
              security: [{ bearerAuth: [] }],
              parameters: [{ name: 'campaignId', in: 'query', required: true, schema: { type: 'string' }}],
              responses: { '200': { description: '조회 성공' }, '403': { description: '권한 없음' } }
          },
          post: {
              summary: "캠페인 지원서 제출",
              tags: ["Applications"],
              security: [{ bearerAuth: [] }],
              requestBody: { content: { 'application/json': { schema: {
                  type: 'object',
                  properties: {
                      campaignId: { type: 'string' },
                      profileRef: { type: 'string' },
                      message: { type: 'string' }
                  }
              }}}},
              responses: { '201': { description: '제출 성공' }, '409': { description: '이미 지원함' } }
          }
      },
      '/applications/mine': {
          get: {
              summary: "내 지원 현황 조회",
              tags: ["Applications"],
              security: [{ bearerAuth: [] }],
              parameters: [{ name: 'campaignId', in: 'query', required: true, schema: { type: 'string' }}],
              responses: { '200': { description: '조회 성공' } }
          }
      },
      '/applications/{id}': {
          patch: {
              summary: "지원서 상태 변경 (소유자)",
              tags: ["Applications"],
              security: [{ bearerAuth: [] }],
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }}],
              requestBody: { content: { 'application/json': { schema: {
                  type: 'object',
                  properties: {
                      status: { type: 'string', enum: ['submitted','reviewing','shortlisted','accepted','rejected'] }
                  }
              }}}},
              responses: { '200': { description: '변경 성공' }, '403': { description: '권한 없음' } }
          }
      },
      // ===== Portfolios =====
      '/portfolios': {
          get: {
              summary: "공개 포트폴리오 목록 조회",
              tags: ["Portfolios"],
              parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
              ],
              responses: { '200': { description: '조회 성공' } }
          },
          post: {
            summary: "내 포트폴리오 생성",
            tags: ["Portfolios"],
            security: [{ bearerAuth: [] }],
            requestBody: { content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            }}}},
            responses: { '201': { description: '생성 성공' }, '400': { description: '이미 존재함' } }
          }
      },
      '/portfolios/mine': {
          get: {
            summary: "내 포트폴리오 조회",
            tags: ["Portfolios"],
            security: [{ bearerAuth: [] }],
            responses: { '200': { description: '조회 성공' }, '404': { description: '포트폴리오 없음' } }
          },
          delete: {
            summary: "내 포트폴리오 삭제",
            tags: ["Portfolios"],
            security: [{ bearerAuth: [] }],
            responses: { '200': { description: '삭제 성공' }, '404': { description: '포트폴리오 없음' } }
          }
      },
      '/portfolios/{id}': {
          put: {
            summary: "내 포트폴리오 수정",
            tags: ["Portfolios"],
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }}],
            requestBody: { content: { 'application/json': { schema: { type: 'object' }}} },
            responses: { '200': { description: '수정 성공' }, '403': { description: '권한 없음' } }
          }
      },
      // ===== Uploads =====
      '/uploads/signature': {
          get: {
              summary: "Cloudinary 업로드 서명 발급",
              tags: ["Uploads"],
              security: [{ bearerAuth: [] }],
              responses: { '200': { description: '발급 성공' } }
          }
      },
      // ===== Scrape =====
      '/scrape': {
          get: {
              summary: "URL 정보 스크래핑",
              tags: ["Scrape"],
              parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string' } }],
              responses: { '200': { description: '성공' }, '500': { description: '실패' } }
          }
      }
    }
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;