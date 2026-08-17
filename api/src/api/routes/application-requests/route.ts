import { listDepartmentEmployeeIds } from "@/contexts/company-compatibility/interface/utils/list-department-employee-ids"
import {
  resolveCompanyAccountParticipants,
  resolveSystemAccountIdsForEmployees,
} from "@/contexts/company-compatibility/application/iam/resolve-company-account-participants"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppApplicationAdminList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { systemProposalQuery } from "@/api/routes/application-requests/lib/system-application-operation"
import {
  toApplicationCurrentStep,
  toApplicationStatus,
  toSystemStatuses,
} from "@/api/routes/application-requests/lib/system-application-view"
import { z } from "zod"

// @authorization permission - 権限キーとCompany組織範囲で判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      scope: z.enum(["department"]).optional(),
      department_code: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const query = c.req.valid("query")
    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    let employeeIds: ReadonlyArray<number>
    if (query.scope === "department") {
      const departmentCode = query.department_code ?? null
      if (departmentCode === null) {
        throw new UnprocessableEntityError("department_code is required for scope=department")
      }
      const departmentEmployeeIds = await listDepartmentEmployeeIds({ c, departmentCode })
      if (departmentEmployeeIds instanceof Error) {
        throw new InternalError("failed to resolve department employees")
      }
      employeeIds = departmentEmployeeIds
      const allowed =
        session.hasPermission("application:read:all") ||
        (session.hasPermission("application:read:department") &&
          employeeIds.includes(session.employeeId))
      if (!allowed) throw new ForbiddenError()
    } else {
      employeeIds = [session.employeeId]
    }
    const accountIds = await resolveSystemAccountIdsForEmployees(c, employeeIds)
    if (accountIds instanceof Error) {
      throw new InternalError("failed to resolve application owners")
    }
    const result = await systemProposalQuery(c).list({
      creatorAccountIds: accountIds,
      actorAccountId: null,
      statuses: toSystemStatuses(query.status),
      procedureKey: null,
      createdFrom: null,
      createdTo: null,
      includeCancelled: false,
      sort: "created_at_desc",
      limit,
      offset,
      at: new Date(c.env.NOW ?? Date.now()),
    })
    if (result instanceof Error) throw new InternalError("failed to list applications")
    const participants = await resolveCompanyAccountParticipants(
      c,
      result.proposals.map((proposal) => proposal.createdByAccountId),
    )
    if (participants instanceof Error) {
      throw new InternalError("failed to resolve application owners")
    }
    const participantByAccount = new Map(
      participants.map((participant) => [participant.accountId, participant]),
    )

    return c.json(
      zAppApplicationAdminList.parse({
        data: result.proposals.map((proposal) => {
          const participant = participantByAccount.get(proposal.createdByAccountId)
          return {
            id: proposal.number,
            template_code: proposal.procedureKey,
            template_name: proposal.title,
            template_category: proposal.category,
            applicant_id: participant?.employeeId ?? 0,
            applicant_name: participant?.employeeName ?? "",
            applicant_dept_name: participant?.departmentName ?? null,
            current_step: toApplicationCurrentStep(proposal),
            status: toApplicationStatus(proposal.status),
            created_at: proposal.createdAt.toISOString(),
          }
        }),
        total: result.total,
      }),
      200,
    )
  },
)
