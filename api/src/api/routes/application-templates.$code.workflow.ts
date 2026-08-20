import { zApplicationWorkflow } from "@/contexts/company/domain/organization/company-procedure-workflow"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import {
  loadSystemProcedure,
  parseSystemProcedureInputSchema,
  parseSystemProcedurePolicy,
  publishSystemProcedure,
} from "@/api/http/application-templates/lib/system-procedure-route"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/contexts/company/interface/lib/errors"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { ConflictError as ApplicationConflictError } from "@/lib/errors"
import { validateApplicationWorkflowReferences } from "@/api/http/application-templates/lib/validate-application-workflow-references"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (!session.hasPermission("application_template:manage")) throw new ForbiddenError()
  const code = validateCodeParam(c.req.param("code"), "template")
  const definition = await loadSystemProcedure(c, code)
  if (definition instanceof Error) throw new InternalError("failed to load template")
  if (definition === null) throw new NotFoundError("template not found")
  const policy = parseSystemProcedurePolicy(definition)
  if (policy instanceof Error) throw new InternalError("invalid template policy")

  return c.json(
    policy.workflow === null
      ? { workflow: null, revision: null, updated_at: null }
      : {
          workflow: policy.workflow,
          revision: policy.workflowRevision,
          updated_at: definition.createdAt.toISOString(),
        },
    200,
  )
})

const workflowUpdateRequest = zApplicationWorkflow.and(
  z.object({ expected_revision: z.number().int().nonnegative() }),
)

// @authorization permission - 権限キーで判定する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", workflowUpdateRequest),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("application_template:manage")) throw new ForbiddenError()
    const code = validateCodeParam(c.req.param("code"), "template")
    const definition = await loadSystemProcedure(c, code)
    if (definition instanceof Error) throw new InternalError("failed to load template")
    if (definition === null) throw new NotFoundError("template not found")
    const currentPolicy = parseSystemProcedurePolicy(definition)
    const schema = parseSystemProcedureInputSchema(definition)
    if (currentPolicy instanceof Error || schema instanceof Error) {
      throw new InternalError("invalid template data")
    }
    const body = c.req.valid("json")
    const workflow = zApplicationWorkflow.parse(body)
    if (body.expected_revision !== currentPolicy.workflowRevision) {
      throw toHttpException(
        new ApplicationConflictError(
          "workflow definition was updated by another administrator",
          "workflow_revision_conflict",
        ),
      )
    }
    if (
      definition.completionOperationKey === "company.personnel-action.apply" &&
      workflow.steps.some((step) => step.rejection_behavior === "return")
    ) {
      throw new UnprocessableEntityError(
        "personnel action workflows must reject immutable requests instead of returning them",
      )
    }
    await validateApplicationWorkflowReferences(c, workflow)
    const policy = createCompanyProcedureDecisionPolicy({
      approverRoles: currentPolicy.approverRoles,
      workflow,
      workflowRevision: body.expected_revision + 1,
    })
    if (policy instanceof Error) throw new InternalError("failed to create procedure policy")
    const saved = await publishSystemProcedure(c, {
      code,
      expectedRevision: definition.revision,
      name: definition.title,
      category: definition.category,
      description: definition.description,
      schemaJson: schema.value,
      policy,
      completionOperationKey: definition.completionOperationKey,
    })
    if (saved === "revision_conflict") {
      throw toHttpException(
        new ApplicationConflictError(
          "workflow definition was updated by another administrator",
          "workflow_revision_conflict",
        ),
      )
    }
    if (saved instanceof Error) throw new InternalError("failed to save workflow")

    return c.json(
      {
        workflow: policy.workflow,
        revision: policy.workflowRevision,
        updated_at: saved.createdAt.toISOString(),
      },
      200,
    )
  },
)
