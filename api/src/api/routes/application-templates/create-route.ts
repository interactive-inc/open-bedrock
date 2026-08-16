import { findUnknownApproverRoles } from "@/contexts/company/application/organization/validate-procedure-policy-references"
import { factory } from "@/contexts/company/interface/utils/factory"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import {
  createLegacyCompanyPolicy,
  publishSystemProcedure,
  systemProcedureRepository,
} from "@/api/routes/application-templates/lib/system-procedure-route"
import { zAppApplicationTemplateDetail } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"
import { ConflictError as ApplicationConflictError, UnprocessableError } from "@/lib/errors"

// @authorization service - session を application service に渡して判定する
/** POST /templates — 申請テンプレートを作成（管理権限のみ） */
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

    const responseBody = zAppApplicationTemplateDetail.parse({
      id: number,
      code: created.key,
      name: created.title,
      category: created.category,
      description: created.description,
      schema_json: JSON.parse(created.inputSchemaJson),
      approver_roles: policy.approverRoles,
    })

    return c.json(responseBody, 201)
  },
)
