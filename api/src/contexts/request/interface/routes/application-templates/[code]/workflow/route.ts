import { zApplicationWorkflow } from "@/contexts/request/domain/application-workflow"
import type { ApplicationWorkflow } from "@/contexts/request/domain/application-workflow"
import { ApplicationTemplateRepository } from "@/contexts/request/infrastructure/application-template-repository"
import { ApplicationWorkflowRepository } from "@/contexts/request/infrastructure/application-workflow-repository"
import { WorkflowRevisionConflictError } from "@/contexts/request/infrastructure/workflow-revision-conflict-error"
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
import { ConflictError as ApplicationConflictError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Context } from "@/env"
import { roles } from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
import { employees } from "@/contexts/company/infrastructure/schema/employee"

async function validateReferences(c: Context, workflow: ApplicationWorkflow) {
  const [roleRows, employeeRows] = await Promise.all([
    c.var.database.select({ key: roles.key }).from(roles),
    c.var.database.select({ code: employees.code }).from(employees),
  ])
  const roleKeys = new Set(roleRows.map((row) => row.key))
  const employeeCodes = new Set(employeeRows.map((row) => row.code))

  for (const step of workflow.steps) {
    for (const selector of [...step.approvers, ...step.escalation_approvers]) {
      if (selector.type === "role" && roleKeys.has(selector.role_key) === false) {
        throw new UnprocessableEntityError(`unknown role in workflow: ${selector.role_key}`)
      }
      if (selector.type === "employee" && employeeCodes.has(selector.employee_code) === false) {
        throw new UnprocessableEntityError(
          `unknown employee in workflow: ${selector.employee_code}`,
        )
      }
    }
  }
}

async function loadTemplate(c: Context, code: string) {
  const template = await new ApplicationTemplateRepository(c).findByCode(code)

  if (template instanceof Error) throw new InternalError("failed to load template")
  if (template === null || template.id === null) throw new NotFoundError("template not found")

  return template
}

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) throw new UnauthorizedError()
  if (session.hasPermission("application_template:manage") === false) throw new ForbiddenError()

  const code = validateCodeParam(c.req.param("code"), "template")
  const template = await loadTemplate(c, code)
  const workflow = await new ApplicationWorkflowRepository(c).findDefinitionRecord(template.id ?? 0)

  if (workflow instanceof Error) throw new InternalError("failed to load workflow")

  return c.json(
    workflow === null
      ? { workflow: null, revision: null, updated_at: null }
      : {
          workflow: workflow.definition,
          revision: workflow.revision,
          updated_at: workflow.updatedAt,
        },
    200,
  )
})

const zWorkflowUpdateRequest = zApplicationWorkflow.and(
  z.object({ expected_revision: z.number().int().nonnegative() }),
)

// @authorization permission - 権限キーで判定する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", zWorkflowUpdateRequest),
  async (c) => {
    const session = c.var.session

    if (session === null) throw new UnauthorizedError()
    if (session.hasPermission("application_template:manage") === false) throw new ForbiddenError()

    const code = validateCodeParam(c.req.param("code"), "template")
    const template = await loadTemplate(c, code)
    const body = c.req.valid("json")
    const workflow = zApplicationWorkflow.parse(body)
    if (
      template.systemBinding === "personnel_action" &&
      workflow.steps.some((step) => step.rejection_behavior === "return")
    ) {
      throw new UnprocessableEntityError(
        "personnel action workflows must reject immutable requests instead of returning them",
      )
    }
    await validateReferences(c, workflow)

    const saved = await new ApplicationWorkflowRepository(c).saveDefinition({
      templateId: template.id ?? 0,
      definition: workflow,
      expectedRevision: body.expected_revision,
      updatedByAccountId: session.accountId,
      updatedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (saved instanceof WorkflowRevisionConflictError) {
      throw toHttpException(
        new ApplicationConflictError(
          "workflow definition was updated by another administrator",
          "workflow_revision_conflict",
        ),
      )
    }
    if (saved instanceof Error) throw new InternalError("failed to save workflow")

    return c.json(
      { workflow: saved.definition, revision: saved.revision, updated_at: saved.updatedAt },
      200,
    )
  },
)
