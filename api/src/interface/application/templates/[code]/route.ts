import { DeleteApplicationTemplate } from "@/application/application/delete-application-template"
import { UpdateApplicationTemplate } from "@/application/application/update-application-template"
import type { ApplicationTemplate } from "@/domain/application/application-template"
import { factory } from "@/lib/factory"
import { applicationTemplates } from "@/schema"
import { jsonPayloadSchema } from "@/interface/shared/json-payload-schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { eq } from "drizzle-orm"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// JSON 文字列を unknown へ。解析できなければ null を返し、呼び出し側の zod 検証で弾く。
function toParsedJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 申請テンプレートをレスポンス用の snake_case に整形する。
function toResponseBody(template: ApplicationTemplate) {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    category: template.category,
    description: template.description,
    schema_json: template.schemaJson,
    approver_roles: template.approverRoles,
  }
}

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

  const responseBody = {
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    schema_json: schemaJson,
    approver_roles: approverRoles,
  }

  return c.json(responseBody, 200)
})

// PUT /templates/:code — 申請テンプレートの内容を変更（管理権限のみ）
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
      viewerRole: session.role,
      code: validateCodeParam(c.req.param("code"), "application template"),
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      schemaJson: body.schema_json ?? {},
      approverRoles: body.approver_roles ?? [],
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update template")
    }

    if ("reason" in updated) {
      if (updated.reason === "template_not_found") {
        throw new NotFoundError("template not found")
      }

      throw new ForbiddenError()
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// DELETE /templates/:code — 申請テンプレートを削除（管理権限のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteApplicationTemplate(c).run({
    viewerRole: session.role,
    code: validateCodeParam(c.req.param("code"), "application template"),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete template")
  }

  if (result.reason === "template_not_found") {
    throw new NotFoundError("template not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "template_in_use") {
    throw new ConflictError("template is in use by pending applications")
  }

  return c.body(null, 204)
})
