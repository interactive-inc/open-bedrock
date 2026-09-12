import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { PublishLeaveProcedure } from "@/contexts/leave/application/publish-leave-procedure"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError, ForbiddenError, InternalError } from "@/lib/http/errors"

// @authorization permission - 規程の参照には提出・判断・設定のいずれかの権限が必要
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (
    !["leave:submit", "leave:approve", "leave:procedure:manage"].some((permission) =>
      session.hasPermission(permission),
    )
  )
    throw new ForbiddenError()
  const definition = await new SystemD1ProcedureRepository(c).find(
    procedureKeySchema.parse("leave_request"),
  )
  if (definition instanceof Error) throw new InternalError("承認規程を取得できません")
  if (definition === null) return c.json({ revision: 0, workflow: null }, 200)
  const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
  if (policy instanceof Error) throw new InternalError("承認規程が不正です")
  return c.json({ revision: definition.revision, workflow: policy.workflow }, 200)
})

// @authorization service - 現在のHumanと規程設定権限を保存時にも照合する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({ expected_revision: z.number().int().nonnegative(), workflow: zApplicationWorkflow })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const saved = await new PublishLeaveProcedure(c).run({
      expectedRevision: body.expected_revision,
      workflow: body.workflow,
      session,
      tokenVersion: c.var.accountTokenVersion,
      publishedAt: new Date(c.env.NOW ?? Date.now()),
    })
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    return c.json({ revision: saved.revision, workflow: body.workflow }, 200)
  },
)
