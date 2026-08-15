import { DeleteApplicationTemplate } from "@/contexts/request/application/delete-application-template"
import { UpdateApplicationTemplate } from "@/contexts/request/application/update-application-template"
import { factory } from "@/contexts/company/interface/utils/factory"
import { applicationTemplates } from "@/contexts/request/infrastructure/schema/request"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { eq } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zAppApplicationTemplate, zAppApplicationTemplateDetail } from "@/lib/app-schemas"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** JSON 文字列を unknown へ。解析できなければ null を返し、呼び出し側の zod 検証で弾く。 */
function toParsedJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "application template")

  const rows = await c.var.database
    .select()
    .from(applicationTemplates)
    .where(eq(applicationTemplates.code, code))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("template not found")
  }

  let schemaJson: unknown
  try {
    schemaJson = JSON.parse(row.schemaJson)
  } catch {
    throw new InternalError("invalid schema_json data")
  }

  const approverRolesParsed = z.array(z.string()).safeParse(toParsedJson(row.approverRoles))

  if (approverRolesParsed.success === false) {
    throw new InternalError("invalid approver_roles data")
  }

  const approverRoles = approverRolesParsed.data

  const responseBody = zAppApplicationTemplate.parse({
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    schema_json: schemaJson,
    approver_roles: approverRoles,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /templates/:code — 申請テンプレートの内容を変更（管理権限のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
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

    const body = c.req.valid("json")

    const updated = await new UpdateApplicationTemplate(c).run({
      session: session,
      code: validateCodeParam(c.req.param("code"), "application template"),
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      schemaJson: body.schema_json ?? {},
      approverRoles: body.approver_roles ?? [],
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppApplicationTemplateDetail.parse({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      category: updated.category,
      description: updated.description,
      schema_json: updated.schemaJson,
      approver_roles: updated.approverRoles,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /templates/:code — 申請テンプレートを削除（管理権限のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteApplicationTemplate(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "application template"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
