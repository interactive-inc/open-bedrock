import { CreateApplicationTemplate } from "@/application/application/create-application-template"
import { factory } from "@/lib/factory"
import { jsonPayloadSchema } from "@/interface/utils/json-payload-schema"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplicationTemplateDetail } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

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

    const body = c.req.valid("json")

    const created = await new CreateApplicationTemplate(c).run({
      session: session,
      code: body.code,
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      schemaJson: body.schema_json ?? {},
      approverRoles: body.approver_roles ?? [],
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppApplicationTemplateDetail.parse({
      id: created.id,
      code: created.code,
      name: created.name,
      category: created.category,
      description: created.description,
      schema_json: created.schemaJson,
      approver_roles: created.approverRoles,
    })

    return c.json(responseBody, 201)
  },
)
