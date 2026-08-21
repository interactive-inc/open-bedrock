import { resolveCompanyAccountParticipants } from "@/contexts/company/interface/http/accounts/resolve-company-account-participants"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { canRepairWorkflow } from "@/api/http/application-requests/lib/can-repair-workflow"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

type WorkflowRepair = {
  id: number
  template_code: string
  template_name: string
  applicant_name: string | null
  step_key: string
  round: number
  reason: "snapshot_missing" | "inactive_candidates"
  started_at: string
}

// @authorization permission - workflow監査とtemplate管理の両権限を要求する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ limit: z.string().optional(), offset: z.string().optional() })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!canRepairWorkflow(session)) {
      throw new ForbiddenError()
    }
    const queryParameters = c.req.valid("query")
    const limit = toBoundedInt({
      raw: queryParameters.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: queryParameters.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    const now = new Date(c.env.NOW ?? Date.now())
    const query = systemProposalQuery(c)
    const pending = await query.list({
      creatorAccountIds: null,
      actorAccountId: null,
      statuses: ["pending"],
      procedureKey: null,
      createdFrom: null,
      createdTo: null,
      includeCancelled: false,
      sort: "created_at_asc",
      limit: 10_000,
      offset: 0,
      at: now,
    })
    if (pending instanceof Error) throw new InternalError("failed to inspect workflow tasks")
    const repairs: WorkflowRepair[] = []
    for (const proposal of pending.proposals) {
      if (proposal.currentTaskKey === null || proposal.currentTaskRound === null) continue
      const tasks = await query.listTasks(proposal.caseId)
      const candidates = await query.listTaskCandidateAccountIds({
        caseId: proposal.caseId,
        taskKey: proposal.currentTaskKey,
        round: proposal.currentTaskRound,
        at: now,
      })
      if (tasks instanceof Error || candidates instanceof Error) {
        throw new InternalError("failed to inspect workflow reachability")
      }
      const current = tasks.find(
        (task) => task.key === proposal.currentTaskKey && task.round === proposal.currentTaskRound,
      )
      if (current === undefined) continue
      const participants = await resolveCompanyAccountParticipants(c, candidates)
      if (participants instanceof Error) {
        throw new InternalError("failed to inspect workflow candidates")
      }
      const reachable = participants.filter(
        (participant) => participant.status === "active" && participant.archivedAt === null,
      ).length
      if (reachable >= current.requiredApprovals) continue
      const owners = await resolveCompanyAccountParticipants(c, [proposal.createdByAccountId])
      if (owners instanceof Error) throw new InternalError("failed to resolve application owner")
      repairs.push({
        id: proposal.number,
        template_code: proposal.procedureKey,
        template_name: proposal.title,
        applicant_name: owners.at(0)?.employeeName ?? null,
        step_key: proposal.currentTaskKey,
        round: proposal.currentTaskRound,
        reason: "inactive_candidates",
        started_at: proposal.currentTaskOpenedAt?.toISOString() ?? proposal.createdAt.toISOString(),
      })
    }

    return c.json({ data: repairs.slice(offset, offset + limit), total: repairs.length }, 200)
  },
)
