import { UpdateApplication } from "@/application/application/update-application"
import { WithdrawApplication } from "@/application/application/withdraw-application"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import { canDecideApplication } from "@/lib/application/can-decide-application"
import { canViewAllApplications } from "@/lib/application/can-view-all-applications"
import {
  resolveRepresentedApprover,
  resolveWorkflowApproverIds,
} from "@/lib/application/resolve-workflow-approvers"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"
import { hasPermission } from "@/lib/auth/has-permission"
import { factory } from "@/lib/factory"
import { applicationApprovals, applications, applicationTemplates, employees } from "@/schema"
import { jsonPayloadSchema } from "@/interface/shared/json-payload-schema"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { asc, eq } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zAppApplication, zAppApplicationUpdated } from "@/lib/app-schemas"
import { z } from "zod"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const applicationId = validateIntParam(c.req.param("id"), "application")

  const rows = await c.var.database
    .select({
      application: applications,
      templateCode: applicationTemplates.code,
      templateName: applicationTemplates.name,
      applicantName: employees.name,
    })
    .from(applications)
    .leftJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .leftJoin(employees, eq(employees.id, applications.applicantId))
    .where(eq(applications.id, applicationId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("application not found")
  }

  // 申請者本人・承認できるロール・全社閲覧権限保持者のみ閲覧できる。ID 走査による他者申請の漏えいを防ぐ。
  // 承認可否は decide-application と同じ二分岐: テンプレートに approverRoles があれば
  // そのロール保持者、無ければ application:approve 権限保持者。
  // application:read:all は監査目的の横断閲覧で、/applications/admin の一覧と対称にする。
  const template = await new ApplicationTemplateRepository(c).findById(row.application.templateId)

  if (template instanceof Error) {
    throw new InternalError("failed to find application template")
  }

  const isOwner = row.application.applicantId === session.employeeId
  const workflowRepository = new ApplicationWorkflowRepository(c)
  const workflowInstance = await workflowRepository.findInstance(applicationId)

  if (workflowInstance instanceof Error) {
    throw new InternalError("failed to load workflow")
  }

  if (isOwner === false) {
    let canApprove = false

    if (workflowInstance !== null && template !== null) {
      const step = workflowInstance.definition.steps.find(
        (candidate) => candidate.key === workflowInstance.currentStepKey,
      )
      if (step !== undefined) {
        const now = c.env.NOW ?? new Date().toISOString()
        const selectors =
          workflowInstance.dueAt !== null && workflowInstance.dueAt < now
            ? [...step.approvers, ...step.escalation_approvers]
            : step.approvers
        const candidates = await resolveWorkflowApproverIds({
          c,
          applicantEmployeeId: row.application.applicantId,
          selectors,
        })
        if (candidates instanceof Error) throw new InternalError("failed to resolve approvers")
        const represented = await resolveRepresentedApprover({
          c,
          actorEmployeeId: session.employeeId,
          candidateEmployeeIds: candidates,
          templateCode: template.code,
          now,
          allowDelegation: step.allow_delegation,
        })
        if (represented instanceof Error) throw new InternalError("failed to resolve delegation")
        canApprove = represented !== null
      }
    } else if (template !== null && template.approverRoles.length > 0) {
      canApprove = session.roleKeys.some((roleKey) => template.approverRoles.includes(roleKey))
    } else if (canDecideApplication(session)) {
      const authority = await resolveOrganizationAuthority(
        c,
        session.employeeId,
        row.application.applicantId,
      )
      if (authority instanceof Error)
        throw new InternalError("failed to resolve organization scope")
      canApprove =
        hasPermission(session, "org:manage") ||
        authority.managementChain ||
        authority.departmentManager
    }

    if (canApprove === false && canViewAllApplications(session) === false) {
      throw new ForbiddenError()
    }
  }

  let payload: unknown
  try {
    payload = JSON.parse(row.application.payload)
  } catch {
    throw new InternalError("invalid payload data")
  }

  // 承認/却下の履歴（古い順）。承認者名は employees から left join で取得する。
  const approvalRows = await c.var.database
    .select({
      id: applicationApprovals.id,
      action: applicationApprovals.action,
      comment: applicationApprovals.comment,
      createdAt: applicationApprovals.createdAt,
      approverName: employees.name,
    })
    .from(applicationApprovals)
    .leftJoin(employees, eq(employees.id, applicationApprovals.approverId))
    .where(eq(applicationApprovals.applicationId, applicationId))
    .orderBy(asc(applicationApprovals.createdAt))

  const workflowApprovals =
    workflowInstance === null ? [] : await workflowRepository.listApprovals(applicationId)
  if (workflowApprovals instanceof Error) {
    throw new InternalError("failed to load workflow approvals")
  }
  const employeeNames = new Map(
    (await c.var.database.select({ id: employees.id, name: employees.name }).from(employees)).map(
      (employee) => [employee.id, employee.name] as const,
    ),
  )
  const currentWorkflowIndex =
    workflowInstance?.definition.steps.findIndex(
      (step) => step.key === workflowInstance.currentStepKey,
    ) ?? -1
  const returned = row.application.currentStep?.startsWith("returned:") ?? false
  const currentActions = workflowApprovals.filter(
    (approval) =>
      approval.stepKey === workflowInstance?.currentStepKey &&
      approval.round === workflowInstance?.currentRound,
  )

  const responseBody = zAppApplication.parse({
    id: row.application.id,
    template_code: row.templateCode ?? "",
    template_name: row.templateName ?? "",
    applicant_name: row.applicantName ?? "",
    status: row.application.status,
    current_step: row.application.currentStep,
    payload,
    created_at: row.application.createdAt,
    approvals: approvalRows.map((approval) => ({
      id: approval.id,
      approver_name: approval.approverName ?? "(削除済みの社員)",
      action: approval.action,
      comment: approval.comment,
      created_at: approval.createdAt,
    })),
    approver_roles: template?.approverRoles ?? [],
    workflow:
      workflowInstance === null
        ? null
        : {
            current_step_key: workflowInstance.currentStepKey,
            current_round: workflowInstance.currentRound,
            started_at: workflowInstance.startedAt,
            due_at: workflowInstance.dueAt,
            returned,
            steps: workflowInstance.definition.steps.map((step, index) => ({
              key: step.key,
              name: step.name,
              status:
                index < currentWorkflowIndex || row.application.status === "approved"
                  ? "approved"
                  : index > currentWorkflowIndex
                    ? "waiting"
                    : returned
                      ? "returned"
                      : currentActions.some((approval) => approval.action === "reject")
                        ? "rejected"
                        : "pending",
            })),
            approvals: workflowApprovals.map((approval) => ({
              id: approval.id,
              step_key: approval.stepKey,
              round: approval.round,
              approver_name: employeeNames.get(approval.approverId) ?? "(削除済みの社員)",
              represented_approver_name:
                employeeNames.get(approval.representedApproverId) ?? "(削除済みの社員)",
              action: approval.action,
              comment: approval.comment,
              created_at: approval.createdAt,
            })),
          },
  })

  return c.json(responseBody, 200)
})

// PUT /applications/:id — 本人が申請内容（payload）を更新（pending のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ payload: jsonPayloadSchema(10_000) })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const applicationId = validateIntParam(c.req.param("id"), "application")

    const body = c.req.valid("json")

    const updated = await new UpdateApplication(c).run({
      applicationId,
      applicantId: session.employeeId,
      payload: body.payload,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppApplicationUpdated.parse({
      id: updated.id,
      status: updated.status,
      payload: updated.payload,
    })

    return c.json(responseBody, 200)
  },
)

// DELETE /applications/:id — 本人が申請を取り下げ（pending のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const applicationId = validateIntParam(c.req.param("id"), "application")

  const result = await new WithdrawApplication(c).run({
    applicationId,
    applicantId: session.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
