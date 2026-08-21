import {
  createLegacyCompanyPolicy,
  parseSystemProcedureInputSchema,
  publishSystemProcedure,
  systemProcedureRepository,
} from "@/api/http/application-templates/lib/system-procedure-route"
import { findUnknownApproverRoles } from "@/contexts/company/domain/organization/validate-procedure-policy-references"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { zAppApplicationTemplateDetail, zAppApplicationTemplateList } from "@/lib/app-schemas"
import { ConflictError as ApplicationConflictError, UnprocessableError } from "@/lib/errors"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - application_template:manage を要求する
/** POST /application-templates — 申請テンプレートを作成（管理権限のみ） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(500),
      category: z.string().min(1).max(200),
      description: z.string().max(3_000).nullable().optional(),
      schema_json: jsonPayloadSchema(10_000),
      approver_roles: z.array(z.string().max(100)).max(20).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }
    if (!session.hasPermission("application_template:manage")) {
      throw new ForbiddenError()
    }

    const body = c.req.valid("json")
    const approverRoles = body.approver_roles ?? []
    const unknownRoles = await findUnknownApproverRoles(c, approverRoles)
    if (unknownRoles instanceof Error) {
      throw new InternalError("failed to validate approver roles")
    }
    if (unknownRoles.length > 0) {
      throw toHttpException(
        new UnprocessableError("unknown approver role", "unknown_approver_role"),
      )
    }
    const policy = createLegacyCompanyPolicy(approverRoles)
    if (policy instanceof Error) throw new InternalError("failed to create procedure policy")
    const created = await publishSystemProcedure(c, {
      code: body.code,
      expectedRevision: 0,
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      schemaJson: body.schema_json ?? {},
      policy,
      completionOperationKey: null,
    })
    if (created === "revision_conflict") {
      throw toHttpException(
        new ApplicationConflictError("template code already exists", "template_code_conflict"),
      )
    }
    if (created instanceof Error) throw new InternalError("failed to create template")
    const number = await systemProcedureRepository(c).findNumber(created.key)
    if (number instanceof Error || number === null) {
      throw new InternalError("failed to load template number")
    }

    const schema = parseSystemProcedureInputSchema(created)
    if (schema instanceof Error) throw new InternalError("invalid template data")

    const responseBody = zAppApplicationTemplateDetail.parse({
      id: number,
      code: created.key,
      name: created.title,
      category: created.category,
      description: created.description,
      schema_json: schema.value,
      approver_roles: policy.approverRoles,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /application-templates — 申請テンプレート一覧（カテゴリで絞り込み可） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const result = await systemProcedureRepository(c).listActive({
      category: query.category ?? null,
      limit,
      offset,
    })
    if (result instanceof Error) throw new InternalError("failed to list templates")

    const responseBody = zAppApplicationTemplateList.parse({
      data: result.definitions.map((definition) => ({
        code: definition.key,
        name: definition.title,
        category: definition.category,
        description: definition.description,
      })),
      total: result.total,
    })

    return c.json(responseBody, 200)
  },
)
