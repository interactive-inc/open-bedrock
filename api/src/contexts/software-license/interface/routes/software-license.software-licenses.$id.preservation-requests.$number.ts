import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import {
  SoftwareLicenseConflictError,
  SoftwareLicenseForbiddenError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyConflictError } from "@/contexts/company/domain/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: licenseIdSchema, number: licenseIdSchema })),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined || authentication.machineCredentialId !== null)
      throw new SoftwareLicenseForbiddenError()
    const at = c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(c).prepare(authentication, at)
    if (proof instanceof Error) throw new SoftwareLicenseUnavailableError()
    if (proof === null || !proof.permissionKeys.has("system:procedure:read"))
      throw new SoftwareLicenseForbiddenError()
    const technical = proof.assertions(at)
    if (technical instanceof Error) throw new SoftwareLicenseForbiddenError()
    const query = new SystemD1ProposalAdapter({
      env: c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const proposal = await query.findByNumber(c.req.valid("param").number)
    if (proposal instanceof Error) throw new SoftwareLicenseUnavailableError()
    if (proposal === null) throw new SoftwareLicenseNotFoundError()
    const caseGuard = await new PrepareSystemCaseReadGuardAdapter(c).prepare({
      caseId: proposal.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (caseGuard instanceof Error) throw new SoftwareLicenseUnavailableError()
    const current = await query.findByNumber(proposal.number)
    if (
      current === null ||
      current instanceof Error ||
      current.caseId !== proposal.caseId ||
      current.status !== proposal.status ||
      current.digest !== proposal.digest ||
      current.currentTaskKey !== proposal.currentTaskKey ||
      current.currentTaskRound !== proposal.currentTaskRound
    )
      throw new SoftwareLicenseConflictError()
    const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
    if (!intent.success) throw new SoftwareLicenseUnavailableError()
    const source = PreservedRecordSourceValue.create(intent.data.source)
    if (source instanceof Error) throw new SoftwareLicenseUnavailableError()
    if (
      source.props.ownerContext !== "software-license" ||
      source.props.recordKind !== "license-record" ||
      source.props.recordId !== String(c.req.valid("param").id) ||
      source.props.sourceNamespace !== c.env.RECORD_SOURCE_NAMESPACE
    )
      throw new SoftwareLicenseNotFoundError()
    if (
      proposal.status !== "pending" ||
      proposal.currentTaskKey === null ||
      proposal.currentTaskRound === null
    )
      throw new SoftwareLicenseConflictError()
    const target = {
      proposal_version: proposal.version,
      proposal_digest: proposal.digest,
      task_key: proposal.currentTaskKey,
      task_round: proposal.currentTaskRound,
    }
    const accountGuard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: c.env.DB,
    }).prepare({
      accountIds: [authentication.accountId],
      employeeCodes: [],
    })
    if (accountGuard instanceof Error) throw new SoftwareLicenseUnavailableError()
    const employees = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: c.env.DB,
        COMPANY_TIME_ZONE: c.env.COMPANY_TIME_ZONE,
        NOW: at.toISOString(),
      },
    }).findForAccountIds([authentication.accountId])
    if (employees instanceof Error) throw new SoftwareLicenseUnavailableError()
    const employee = employees[0]?.employee
    if (employee === undefined) throw new SoftwareLicenseForbiddenError()
    const decision = await new PrepareCompanyProcedureDecisionAdapter(c).prepare({
      proposal,
      decisionTarget: {
        proposalVersion: target.proposal_version,
        proposalDigest: target.proposal_digest,
        taskKey: target.task_key,
        taskRound: target.task_round,
      },
      actorAccountId: authentication.accountId,
      actorEmployeeId: employee.id,
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set(),
      action: "approve",
      decidedAt: at,
    })
    if (decision instanceof CompanyConflictError) throw new SoftwareLicenseConflictError()
    if (decision instanceof Error) throw new SoftwareLicenseForbiddenError()
    const prepareOriginal = async () => {
      if (c.req.valid("query").include_original !== "true") return null
      const value = await RecordPreservationProposalValue.restore(JSON.parse(proposal.bodyJson))
      if (value instanceof Error || value.props.digest.toString() !== proposal.digest)
        throw new SoftwareLicenseUnavailableError()
      const pending = value.toFinalization({
        actorAccountId: proposal.createdByAccountId,
        at: proposal.createdAt,
      })
      if (pending instanceof Error) throw new SoftwareLicenseUnavailableError()
      const verified = await new VerifyPreservedRecordContentAdapter(c).execute(
        pending.record,
        "pending",
      )
      if (verified instanceof Error) throw new SoftwareLicenseUnavailableError()
      return {
        source: verified.payload.source.props,
        contentBase64: toBase64(new Uint8Array(verified.payload.content.toBytes())),
        guard: new PrepareAttachmentContentReadGuardAdapter(c).prepare(
          verified.attachment,
          c.var.now(),
          "pending",
        ),
      }
    }
    const original = await prepareOriginal()
    const now = c.var.now()
    const assertions = proof.assertions(now)
    if (assertions instanceof Error) throw new SoftwareLicenseForbiddenError()
    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: "system.proposal.review.read",
      targetType: "system:proposal",
      targetId: proposal.proposalId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ required_permission_keys: ["system:procedure:read"] }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        number: proposal.number,
        digest: proposal.digest,
        includes_original: original !== null,
      }),
      occurredAt: now,
    })
    if (audit instanceof Error) throw new SoftwareLicenseUnavailableError()
    const guards = [
      ...assertions,
      accountGuard,
      ...decision.guards,
      caseGuard(now),
      ...(original === null ? [] : [original.guard]),
    ]
    const recorded = await new SystemAuditEventRepository(c).append(audit, guards, guards)
    if (recorded instanceof Error) throw new SoftwareLicenseConflictError()
    return c.json(
      {
        number: proposal.number,
        status: proposal.status,
        body: intent.data,
        original:
          original === null
            ? null
            : { source: original.source, contentBase64: original.contentBase64 },
        decision_target: target,
        procedure: {
          key: proposal.procedureKey,
          revision: proposal.procedureRevision,
          title: proposal.title,
          decision_policy_json: proposal.decisionPolicyJson,
        },
      },
      200,
    )
  },
)
