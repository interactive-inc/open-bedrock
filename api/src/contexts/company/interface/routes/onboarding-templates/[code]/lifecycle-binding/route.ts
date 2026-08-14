import { UpdateLifecycleTemplateBinding } from "@/contexts/company/application/onboarding/update-lifecycle-template-binding"
import { RemoveLifecycleTemplateBinding } from "@/contexts/company/application/onboarding/remove-lifecycle-template-binding"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.strictObject({ effect_type: z.enum(["hire", "retired"]) })),
  async (c) => {
    if (c.var.session === null) throw new UnauthorizedError()
    const result = await new UpdateLifecycleTemplateBinding(c).run({
      session: c.var.session,
      templateCode: validateCodeParam(c.req.param("code"), "onboarding template"),
      effectType: c.req.valid("json").effect_type,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json({ effect_type: result.effectType, template_code: result.templateCode }, 200)
  },
)

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) throw new UnauthorizedError()
  const result = await new RemoveLifecycleTemplateBinding(c).run({
    session: c.var.session,
    templateCode: validateCodeParam(c.req.param("code"), "onboarding template"),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.body(null, 204)
})
