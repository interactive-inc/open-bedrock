import { ApplyPersonnelAction } from "@/contexts/company-compatibility/application/employee-lifecycle/apply-personnel-action"
import { PersonnelActionRequestAccess } from "@/contexts/company-compatibility/application/employee-lifecycle/procedure/personnel-action-request-access"
import { resolveActiveSystemAccountId } from "@/contexts/company-compatibility/application/iam/to-system-account-id"
import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { ApplicationError, ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ExecutionAuthorization } from "@system/domain/workflow/execution-authorization.entity"
import { proposalDigestSchema } from "@system/domain/workflow/system-case-reference"
import { systemCaseIdSchema } from "@system/domain/workflow/system-case.entity"
import { SystemD1AuthorizedExecutionWriter } from "@system/infrastructure/workflow/system-d1-authorized-execution-writer"

const OPERATION_KEY = "company.personnel-action.apply"

/** 承認済みSystem提案を、digestを保った一回限りのCompany人事発令へ反映する。 */
export class CompleteApprovedPersonnelActionRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Readonly<{
      applicationId: number
      session: Session
      completedAt: Date
    }>,
  ): Promise<Readonly<{ actionId: string }> | ApplicationError> {
    const request = await new PersonnelActionRequestAccess({
      c: this.c,
      session: command.session,
    }).findByApplicationId(command.applicationId)
    if (request instanceof ApplicationError) return request
    if (request === null) {
      return new NotFoundError("人事変更申請が見つかりません", "personnel_action_request_not_found")
    }
    if (request.status !== "approved" || request.withdrawnAt !== null) {
      return new ConflictError("人事変更申請は実行できません", "already_decided")
    }
    if (request.appliedActionId !== null) return { actionId: request.appliedActionId }

    const prepared = await new ApplyPersonnelAction(this.c).prepareApplicationCompletion({
      session: command.session,
      employeeId: request.targetEmployeeId,
      input: request.action,
      sourceApplicationId: request.applicationId,
      requestedByEmployeeId: request.requestedByEmployeeId,
      expectedEmployeeRevision: request.baseEmployeeRevision,
      expectedOrganizationRevision: request.baseOrganizationRevision,
      expectedPayloadFingerprint: request.payloadFingerprint,
    })
    if (prepared instanceof ApplicationError) return prepared
    const accountId = await resolveActiveSystemAccountId(this.c, command.session.accountId)
    if (accountId instanceof Error) {
      return new UnexpectedError("実行者のSystemアカウントを解決できません", {
        cause: accountId,
      })
    }
    const caseId = systemCaseIdSchema.safeParse(request.systemCaseId)
    const digest = proposalDigestSchema.safeParse(request.proposalDigest)
    if (!caseId.success || !digest.success) {
      return new UnexpectedError("人事変更申請のSystem証跡が不正です")
    }
    const authorization = ExecutionAuthorization.create({
      id: crypto.randomUUID(),
      caseId: caseId.data,
      operationKey: OPERATION_KEY,
      proposalDigest: digest.data,
      grantedToAccountId: accountId,
      grantedAt: command.completedAt,
      expiresAt: new Date(command.completedAt.getTime() + 5 * 60 * 1_000),
      usedAt: null,
    })
    if (authorization instanceof Error) {
      return new UnexpectedError("System実行許可を作成できません", { cause: authorization })
    }
    const executed = await new SystemD1AuthorizedExecutionWriter({
      env: { DB: this.c.env.DB },
    }).execute({
      authorization,
      proposalDigest: digest.data,
      executedAt: command.completedAt,
      operationStatements: [
        ...prepared.statements,
        this.c.env.DB.prepare(
          `UPDATE personnel_action_requests
             SET applied_action_id = ?2, target_employee_id = ?4
             WHERE id = ?1 AND application_id = ?3
               AND applied_action_id IS NULL AND withdrawn_at IS NULL`,
        ).bind(request.id, prepared.action.id, request.applicationId, prepared.action.employeeId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ],
    })
    if (executed instanceof Error) {
      const replay = await new PersonnelActionRequestAccess({
        c: this.c,
        session: command.session,
      }).findByApplicationId(command.applicationId)
      if (
        !(replay instanceof ApplicationError) &&
        replay !== null &&
        replay.appliedActionId !== null
      ) {
        return { actionId: replay.appliedActionId }
      }
      return new UnexpectedError("承認済み人事変更を実行できません", { cause: executed })
    }

    return { actionId: prepared.action.id }
  }
}
