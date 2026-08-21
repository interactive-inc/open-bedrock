import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template.repository"
import { DeleteOnboardingTemplate } from "@/contexts/onboarding/application/delete-onboarding-template"
import { UpdateOnboardingTemplate } from "@/contexts/onboarding/application/update-onboarding-template"
import type { OnboardingTemplate } from "@/contexts/onboarding/domain/onboarding-template.entity"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppOnboardingTemplate } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** オンボーディングテンプレートをレスポンス用の snake_case に整形する。 */
function toResponseBody(template: OnboardingTemplate) {
  return zAppOnboardingTemplate.parse({
    id: template.id,
    code: template.code,
    name: template.name,
    kind: template.kind,
    description: template.description,
  })
}

// @authorization service - session を application service に渡して判定する
/** GET /onboarding-templates/:code — テンプレート詳細（管理権限のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const template = await (async () => {
    const command = {
      session: session,
      code: validateCodeParam(c.req.param("code"), "onboarding template"),
    }

    const templateRepository = new OnboardingTemplateRepository(c)

    if (command.session.hasPermission("onboarding:manage") === false) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    const template = await templateRepository.findByCode(command.code)

    if (template instanceof Error) {
      return new UnexpectedError("failed to find template", { cause: template })
    }

    if (template === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    return template
  })()

  if (template instanceof ApplicationError) {
    throw toHttpException(template)
  }

  return c.json(toResponseBody(template), 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /onboarding-templates/:code — テンプレートの内容を変更（管理権限のみ） */
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
      session: session,
      code: validateCodeParam(c.req.param("code"), "onboarding template"),
      name: json.name,
      kind: json.kind,
      description: json.description ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /onboarding-templates/:code — テンプレートを削除（管理権限のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteOnboardingTemplate(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "onboarding template"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
