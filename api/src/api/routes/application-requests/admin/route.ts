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
} from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppApplicationAdminList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { z } from "zod"
import { loadCurrentEmployeeDepartmentNames } from "@/contexts/company-compatibility/interface/utils/current-employee-departments"
import { systemProposalQuery } from "@/api/routes/application-requests/lib/system-application-operation"
import {
  toApplicationCurrentStep,
  toApplicationStatus,
  toSystemStatuses,
} from "@/api/routes/application-requests/lib/system-application-view"

// @authorization permission - application:read:all保持者だけに限定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      applicant_id: z.string().optional(),
      template_code: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("application:read:all")) throw new ForbiddenError()
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
    let creatorAccountIds = null
    if (query.applicant_id !== undefined && query.applicant_id !== "") {
      const applicantId = Number(query.applicant_id)
      if (Number.isInteger(applicantId)) {
        const resolved = await resolveSystemAccountIdsForEmployees(c, [applicantId])
        if (resolved instanceof Error) {
          throw new InternalError("failed to resolve application owner")
        }
        creatorAccountIds = resolved
      }
    }
    const createdFrom = parseDate(query.from)
    const createdTo = parseDate(query.to)
    const result = await systemProposalQuery(c).list({
      creatorAccountIds,
      actorAccountId: null,
      statuses: toSystemStatuses(query.status),
      procedureKey:
        query.template_code === undefined || query.template_code === ""
          ? null
          : query.template_code,
      createdFrom,
      createdTo,
      includeCancelled: false,
      sort: query.sort === "created_at_asc" ? "created_at_asc" : "created_at_desc",
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
    const departments = await loadCurrentEmployeeDepartmentNames(
      c,
      participants.map((participant) => participant.employeeId),
    )
    if (departments instanceof Error) {
      throw new InternalError("failed to load current departments")
    }

    return c.json(
      zAppApplicationAdminList.parse({
        data: result.proposals.map((proposal) => {
          const participant = participantByAccount.get(proposal.createdByAccountId)
          const employeeId = participant?.employeeId ?? 0
          return {
            id: proposal.number,
            template_code: proposal.procedureKey,
            template_name: proposal.title,
            template_category: proposal.category,
            applicant_id: employeeId,
            applicant_name: participant?.employeeName ?? "",
            applicant_dept_name:
              departments.source === "lifecycle"
                ? (departments.names.get(employeeId) ?? null)
                : (participant?.departmentName ?? null),
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

function parseDate(value: string | undefined): Date | null {
  if (value === undefined || value === "") return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
