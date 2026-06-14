import { DeleteOnboardingTemplate } from "@/application/onboarding/delete-onboarding-template"
import { GetOnboardingTemplate } from "@/application/onboarding/get-onboarding-template"
import { UpdateOnboardingTemplate } from "@/application/onboarding/update-onboarding-template"
import type { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
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

// オンボーディングテンプレートをレスポンス用の snake_case に整形する。
function toResponseBody(template: OnboardingTemplate) {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    kind: template.kind,
    description: template.description,
  }
}

// GET /onboarding/templates/:code — テンプレート詳細（管理権限のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const template = await new GetOnboardingTemplate(c).run({
    viewerRole: session.role,
    code: validateCodeParam(c.req.param("code"), "onboarding template"),
  })

  if (template instanceof Error) {
    throw new InternalError("failed to load onboarding template")
  }

  if ("reason" in template) {
    if (template.reason === "template_not_found") {
      throw new NotFoundError("template not found")
    }

    throw new ForbiddenError()
  }

  return c.json(toResponseBody(template), 200)
})

// PUT /onboarding/templates/:code — テンプレートの内容を変更（管理権限のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(500),
      kind: z.enum(["join", "leave"]),
      description: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateOnboardingTemplate(c).run({
      viewerRole: session.role,
      code: validateCodeParam(c.req.param("code"), "onboarding template"),
      name: json.name,
      kind: json.kind,
      description: json.description ?? null,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update onboarding template")
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

// DELETE /onboarding/templates/:code — テンプレートを削除（管理権限のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteOnboardingTemplate(c).run({
    viewerRole: session.role,
    code: validateCodeParam(c.req.param("code"), "onboarding template"),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete onboarding template")
  }

  if (result.reason === "template_not_found") {
    throw new NotFoundError("template not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "template_in_use") {
    throw new ConflictError("template is in use by active onboarding assignments")
  }

  return c.body(null, 204)
})
