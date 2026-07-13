import { zApplicationWorkflow } from "@/domain/application/application-workflow"
import type { ApplicationWorkflow } from "@/domain/application/application-workflow"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import type { Context } from "@/env"
import { employees, roles } from "@/schema"

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

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) throw new UnauthorizedError()
  if (canManageApplicationTemplates(session) === false) throw new ForbiddenError()

  const code = validateCodeParam(c.req.param("code"), "template")
  const template = await loadTemplate(c, code)
  const workflow = await new ApplicationWorkflowRepository(c).findDefinition(template.id ?? 0)

  if (workflow instanceof Error) throw new InternalError("failed to load workflow")

  return c.json({ workflow }, 200)
})

export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", zApplicationWorkflow),
  async (c) => {
    const session = c.var.session

    if (session === null) throw new UnauthorizedError()
    if (canManageApplicationTemplates(session) === false) throw new ForbiddenError()

    const code = validateCodeParam(c.req.param("code"), "template")
    const template = await loadTemplate(c, code)
    const workflow = c.req.valid("json")
    await validateReferences(c, workflow)

    const saved = await new ApplicationWorkflowRepository(c).upsertDefinition({
      templateId: template.id ?? 0,
      definition: workflow,
      updatedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (saved instanceof Error) throw new InternalError("failed to save workflow")

    return c.json({ workflow }, 200)
  },
)
