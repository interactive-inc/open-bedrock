import { UpdateApplication } from "@/contexts/company/application/application/update-application"
import { WithdrawApplication } from "@/contexts/company/application/application/withdraw-application"
import { ApplicationTemplateRepository } from "@/contexts/company/infrastructure/application/application-template-repository"
import { ApplicationWorkflowRepository } from "@/contexts/company/infrastructure/application/application-workflow-repository"
import { canDecideLegacyApplication } from "@/lib/application/can-decide-legacy-application"
import { resolveRepresentedApprover } from "@/lib/application/resolve-represented-approver"
import { loadOrResolveWorkflowStepSnapshot } from "@/lib/application/load-or-resolve-workflow-step-snapshot"
import { ensureWorkflowStepEscalation } from "@/lib/application/ensure-workflow-step-escalation"
import { factory } from "@/contexts/company/interface/utils/factory"
import { applicationApprovals, applications, applicationTemplates, employees } from "@/schema"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { and, asc, eq, inArray } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  ForbiddenError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zAppApplication, zAppApplicationUpdated } from "@/lib/app-schemas"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
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

  const subjectRow = await c.env.DB.prepare(
    `SELECT subject.subject_type, subject.subject_employee_id,
            subject.subject_snapshot_json, subject.target_department_code,
            employee.code AS employee_code, employee.name AS employee_name,
            department.name AS target_department_name
     FROM application_subjects subject
     LEFT JOIN employees employee ON employee.id = subject.subject_employee_id
     LEFT JOIN org_departments organization
       ON organization.code = subject.target_department_code
     LEFT JOIN departments department ON department.id = organization.department_id
     WHERE subject.application_id = ?1`,
  )
    .bind(applicationId)
    .first<{
      subject_type: "employee" | "prospective_employee"
      subject_employee_id: number | null
      subject_snapshot_json: string | null
      target_department_code: string | null
      employee_code: string | null
      employee_name: string | null
      target_department_name: string | null
    }>()

  let subject: {
    type: "employee" | "prospective_employee"
    employee_code: string
    employee_name: string
  } | null = null
  if (subjectRow !== null) {
    if (
      subjectRow.subject_type === "employee" &&
      subjectRow.employee_code !== null &&
      subjectRow.employee_name !== null
    ) {
      subject = {
        type: "employee",
        employee_code: subjectRow.employee_code,
        employee_name: subjectRow.employee_name,
      }
    } else if (
      subjectRow.subject_type === "prospective_employee" &&
      subjectRow.subject_snapshot_json !== null
    ) {
      try {
        const snapshot = JSON.parse(subjectRow.subject_snapshot_json) as Record<string, unknown>
        if (
          typeof snapshot.employeeCode !== "string" ||
          typeof snapshot.employeeName !== "string"
        ) {
          throw new Error("invalid prospective employee snapshot")
        }
        subject = {
          type: "prospective_employee",
          employee_code: snapshot.employeeCode,
          employee_name: snapshot.employeeName,
        }
      } catch {
        throw new InternalError("invalid application subject")
      }
    } else {
      throw new InternalError("invalid application subject")
    }
  }

  // 申請者本人・全社閲覧権限保持者・申請に参加した承認者のみ閲覧できる。
  // 未完了の旧形式申請だけは現在の組織/ロール上の承認者も許可するが、完了後は保存済み履歴を正とする。
  // application:read:all は監査目的の横断閲覧で、/application-requests/admin の一覧と対称にする。
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

    if (subjectRow !== null) {
      canApprove =
        (await c.env.DB.prepare(
          `SELECT 1 AS found
           WHERE EXISTS (
             SELECT 1 FROM application_workflow_step_candidates
             WHERE application_id = ?1 AND candidate_employee_id = ?2
           ) OR EXISTS (
             SELECT 1 FROM application_workflow_approvals
             WHERE application_id = ?1
               AND (approver_id = ?2 OR represented_approver_id = ?2)
           )`,
        )
          .bind(applicationId, session.employeeId)
          .first<number>("found")) === 1
    }

    if (canApprove === false && workflowInstance !== null && template !== null) {
      const step = workflowInstance.definition.steps.find(
        (candidate) => candidate.key === workflowInstance.currentStepKey,
      )
      if (step !== undefined) {
        const now = c.env.NOW ?? new Date().toISOString()
        const isCurrentPendingStep =
          row.application.status === "pending" &&
          row.application.currentStep === workflowInstance.currentStepKey
        if (isCurrentPendingStep) {
          const loadedSnapshot = await loadOrResolveWorkflowStepSnapshot({
            c,
            instance: workflowInstance,
            applicantEmployeeId:
              subjectRow?.subject_type === "prospective_employee"
                ? null
                : (subjectRow?.subject_employee_id ?? row.application.applicantId),
            step,
            now,
            excludedEmployeeIds:
              subjectRow === null
                ? undefined
                : new Set(
                    subjectRow.subject_employee_id === null
                      ? [row.application.applicantId]
                      : [row.application.applicantId, subjectRow.subject_employee_id],
                  ),
            targetDepartmentCode: subjectRow?.target_department_code ?? null,
          })
          if (loadedSnapshot instanceof Error) throw new ConflictError("workflow_unresolvable")

          const snapshot = loadedSnapshot.persisted
            ? await ensureWorkflowStepEscalation({
                c,
                snapshot: loadedSnapshot.snapshot,
                now,
              })
            : loadedSnapshot.snapshot
          if (snapshot instanceof Error) {
            throw new InternalError("failed to activate workflow escalation")
          }
          const eligibleCandidates = snapshot.candidates.filter(
            (candidate) => candidate.source === "primary" || snapshot.escalatedAt !== null,
          )
          const represented = await resolveRepresentedApprover({
            c,
            actorEmployeeId: session.employeeId,
            actorAccountId: session.accountId,
            candidateAccounts: eligibleCandidates.map((candidate) => ({
              employeeId: candidate.employeeId,
              accountId: candidate.accountId,
            })),
            templateCode: template.code,
            now,
            allowDelegation: step.allow_delegation,
          })
          if (represented instanceof Error) {
            throw new InternalError("failed to resolve delegation")
          }
          canApprove = represented !== null
        } else {
          const snapshot = await workflowRepository.findStepSnapshot(
            workflowInstance.applicationId,
            workflowInstance.currentStepKey,
            workflowInstance.currentRound,
          )
          if (snapshot instanceof Error) {
            throw new InternalError("failed to load workflow step snapshot")
          }
          const recordedApprovals = await workflowRepository.listApprovals(applicationId)
          if (recordedApprovals instanceof Error) {
            throw new InternalError("failed to load workflow approvals")
          }
          const wasFrozenCandidate =
            snapshot?.candidates.some(
              (candidate) =>
                candidate.employeeId === session.employeeId &&
                candidate.accountId === session.accountId,
            ) ?? false
          const wasRecordedParticipant = recordedApprovals.some(
            (approval) =>
              approval.approverId === session.employeeId ||
              approval.representedApproverId === session.employeeId,
          )
          canApprove = wasFrozenCandidate || wasRecordedParticipant
        }
      }
    } else if (canApprove === false && template !== null) {
      if (row.application.status === "pending") {
        const legacyAuthority = await canDecideLegacyApplication({
          c,
          session,
          applicantEmployeeId: row.application.applicantId,
          approverRoles: template.approverRoles,
        })
        if (legacyAuthority instanceof Error) {
          throw new InternalError("failed to resolve organization scope")
        }
        canApprove = legacyAuthority
      } else {
        const persistedParticipation = await c.var.database
          .select({ id: applicationApprovals.id })
          .from(applicationApprovals)
          .where(
            and(
              eq(applicationApprovals.applicationId, applicationId),
              eq(applicationApprovals.approverId, session.employeeId),
            ),
          )
          .limit(1)
        canApprove = persistedParticipation.length > 0
      }
    }

    if (canApprove === false && session.hasPermission("application:read:all") === false) {
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
  // Collect only the employee IDs referenced by workflow approvals instead of
  // loading the entire employees table into memory.
  const neededEmployeeIds = [
    ...new Set(
      workflowApprovals.flatMap((approval) => [
        approval.approverId,
        approval.representedApproverId,
      ]),
    ),
  ]
  const employeeNames = new Map<number, string>()
  if (neededEmployeeIds.length > 0) {
    const nameRows = await c.var.database
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(inArray(employees.id, neededEmployeeIds))
    for (const row of nameRows) {
      employeeNames.set(row.id, row.name)
    }
  }
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
    subject,
    target_department:
      subjectRow?.target_department_code === null ||
      subjectRow?.target_department_code === undefined ||
      subjectRow.target_department_name === null
        ? null
        : {
            code: subjectRow.target_department_code,
            name: subjectRow.target_department_name,
          },
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
    approver_roles: workflowInstance === null ? (template?.approverRoles ?? []) : [],
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

// @authorization owner - 本人のリソースに限定する
/** PUT /application-requests/:id — 本人が申請内容（payload）を更新（pending のみ） */
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

// @authorization owner - 本人のリソースに限定する
/** DELETE /application-requests/:id — 本人が申請を取り下げ（pending のみ） */
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
