import { CreateApplicationTemplate } from "@/application/application/create-application-template"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /templates — 申請テンプレートを作成（管理権限のみ）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      description: z.string().nullable().optional(),
      schema_json: z.unknown(),
      approver_roles: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new CreateApplicationTemplate(c).run({
      viewerRole: session.role,
      code: body.code,
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      schemaJson: body.schema_json ?? {},
      approverRoles: body.approver_roles ?? [],
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create template")
    }

    if ("reason" in created) {
      if (created.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("template code already exists")
    }

    const responseBody = {
      id: created.id,
      code: created.code,
      name: created.name,
      category: created.category,
      description: created.description,
      schema_json: created.schemaJson,
      approver_roles: created.approverRoles,
    }

    return c.json(responseBody, 201)
  },
)
