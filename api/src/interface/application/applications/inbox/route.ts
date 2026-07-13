import { canDecideApplication } from "@/lib/application/can-decide-application"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import {
  applications,
  applicationTemplates,
  applicationWorkflowInstances,
  employees,
} from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { and, asc, count, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm"

// 並び順クエリのホワイトリスト。未知の値は created_at desc にフォールバックする。
const SORT_OPTIONS = {
  created_at_desc: desc(applications.createdAt),
  created_at_asc: asc(applications.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplicationInboxList } from "@/lib/app-schemas"
import { hasPermission } from "@/lib/auth/has-permission"
import { listManagedEmployeeIds } from "@/lib/org/organization-authority"
import { InternalError } from "@/interface/lib/errors"
import { parseApplicationWorkflow } from "@/domain/application/application-workflow"
import {
  resolveRepresentedApprover,
  resolveWorkflowApproverIds,
} from "@/lib/application/resolve-workflow-approvers"

// GET /applications/inbox — 承認待ちの申請一覧。
// テンプレートの approverRoles に自分のロールが含まれるか、approverRoles が空で
// canDecideApplication を満たす場合に表示する。DecideApplication の権限判定と対称にする。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  // approverRoles は JSON 配列文字列（例: '["manager","admin"]'）。
  // viewer の保持ロール（複数）のいずれかがリストに含まれるテンプレートの申請を返す。
  // approverRoles が空（"[]"）の場合は canDecideApplication で許可されたロールだけ。
  // DecideApplication の approverRoles チェックと同じ二分岐に合わせる。
  const roleMatches = session.roleKeys.map((roleKey) =>
    like(applicationTemplates.approverRoles, `%"${roleKey}"%`),
  )

  const isPrivileged = canDecideApplication(session)

  const managedEmployeeIds =
    isPrivileged === false || hasPermission(session, "org:manage")
      ? null
      : await listManagedEmployeeIds(c, session.employeeId)

  if (managedEmployeeIds instanceof Error) {
    throw new InternalError("failed to resolve organization scope")
  }

  const legacyScope =
    isPrivileged === false
      ? undefined
      : managedEmployeeIds === null
        ? eq(applicationTemplates.approverRoles, "[]")
        : managedEmployeeIds.length === 0
          ? and(eq(applicationTemplates.approverRoles, "[]"), sql`0 = 1`)
          : and(
              eq(applicationTemplates.approverRoles, "[]"),
              inArray(applications.applicantId, [...managedEmployeeIds]),
            )

  const workflowRows = await c.var.database
    .select({
      applicationId: applications.id,
      applicantId: applications.applicantId,
      templateCode: applicationTemplates.code,
      definitionJson: applicationWorkflowInstances.definitionJson,
      currentStepKey: applicationWorkflowInstances.currentStepKey,
      dueAt: applicationWorkflowInstances.dueAt,
    })
    .from(applicationWorkflowInstances)
    .innerJoin(applications, eq(applications.id, applicationWorkflowInstances.applicationId))
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .where(
      and(
        eq(applications.status, "pending"),
        eq(applications.currentStep, applicationWorkflowInstances.currentStepKey),
        ne(applications.applicantId, session.employeeId),
      ),
    )

  const eligibleWorkflowIds = (
    await Promise.all(
      workflowRows.map(async (row) => {
        let decoded: unknown
        try {
          decoded = JSON.parse(row.definitionJson)
        } catch {
          return null
        }

        const workflow = parseApplicationWorkflow(decoded)
        if (workflow instanceof Error) return null
        const step = workflow.steps.find((candidate) => candidate.key === row.currentStepKey)
        if (step === undefined) return null

        const selectors =
          row.dueAt !== null && row.dueAt < (c.env.NOW ?? new Date().toISOString())
            ? [...step.approvers, ...step.escalation_approvers]
            : step.approvers
        const candidates = await resolveWorkflowApproverIds({
          c,
          applicantEmployeeId: row.applicantId,
          selectors,
        })
        if (candidates instanceof Error) return null

        const represented = await resolveRepresentedApprover({
          c,
          actorEmployeeId: session.employeeId,
          candidateEmployeeIds: candidates,
          templateCode: row.templateCode,
          now: c.env.NOW ?? new Date().toISOString(),
          allowDelegation: step.allow_delegation,
        })

        return typeof represented === "number" ? row.applicationId : null
      }),
    )
  ).filter((id): id is number => id !== null)

  const workflowScope =
    eligibleWorkflowIds.length === 0 ? undefined : inArray(applications.id, eligibleWorkflowIds)

  const pendingWithRole = and(
    eq(applications.status, "pending"),
    ne(applications.applicantId, session.employeeId),
    or(
      workflowScope,
      and(
        sql`NOT EXISTS (
          SELECT 1 FROM application_workflow_instances workflow_instance
          WHERE workflow_instance.application_id = ${applications.id}
        )`,
        or(legacyScope, ...roleMatches),
      ),
    ),
  )

  const sortQuery = c.req.query("sort") ?? ""

  const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "created_at_desc"

  // 一覧では payload（大きい JSON 文字列）を返さないため、必要な列だけを取得する。
  const rows = await c.var.database
    .select({
      id: applications.id,
      currentStep: applications.currentStep,
      status: applications.status,
      createdAt: applications.createdAt,
      templateName: applicationTemplates.name,
      applicantName: employees.name,
    })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .leftJoin(employees, eq(employees.id, applications.applicantId))
    .where(pendingWithRole)
    .orderBy(SORT_OPTIONS[sortKey])
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .where(pendingWithRole)

  const responseBody = zAppApplicationInboxList.parse({
    data: rows.map((row) => ({
      id: row.id,
      template_name: row.templateName ?? "",
      applicant_name: row.applicantName ?? "",
      current_step: row.currentStep,
      status: row.status,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
