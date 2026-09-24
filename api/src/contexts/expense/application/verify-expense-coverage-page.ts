import { ExpenseRecordSystemAdapter } from "@/contexts/expense/infrastructure/adapters/expense-record-system.adapter"
import {
  ExpenseCoverageForbiddenError,
  ExpenseCoverageConflictError,
} from "@/contexts/expense/application/errors"
import { expenseCoveragePageCommandSchema } from "@/contexts/expense/domain/schemas/expense-coverage-page-command.schema"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { SystemClockContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { ForbiddenError } from "@/lib/errors"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CaptureFrozenExpenseRecordPageAdapter } from "@/contexts/expense/infrastructure/adapters/capture-frozen-expense-record-page.adapter"
import { PrepareExpenseCoverageRecordsAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-coverage-records.adapter"

type Context = CompanyContext &
  SystemClockContext &
  Readonly<{ var: Readonly<{ bearerReadAuthentication?: SystemReadAuthentication }> }> &
  SystemDatabaseContext &
  SystemAttachmentStorageContext

/** 保存済みの続きから経費の各種本文を照合し、同じ停止世代のページと監査を保存する。 */
export class VerifyExpenseCoveragePage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string): Promise<RecordCoveragePageEntity | Error> {
    const parsed = expenseCoveragePageCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new ExpenseCoverageForbiddenError("coverage authentication required")
    const proof = await new ExpenseRecordSystemAdapter(this.c).prepareSourceFreezeAuthorization({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (proof instanceof Error) return proof
    if (proof === "forbidden")
      return new ExpenseCoverageForbiddenError("coverage authorization denied")
    const generation = await new ExpenseRecordSystemAdapter({
      env: this.c.env,
      assertions: proof.assertions,
    })
      .sourceFreezes()
      .prepareActiveGeneration({
        id: command.freezeId,
        sourceNamespace: command.sourceNamespace,
        ownerContext: "expense",
      })
    if (generation instanceof Error) return generation
    const completion = new ExpenseRecordSystemAdapter({
      env: this.c.env,
      assertions: generation.assertions,
    })
    const repository = new ExpenseRecordSystemAdapter({
      env: this.c.env,
      assertions: generation.assertions,
    }).coveragePages()
    const existing = await repository.find(command.id)
    if (existing instanceof Error) return existing
    if (
      existing !== null &&
      (existing.snapshot.freezeId !== command.freezeId ||
        existing.snapshot.actorAccountId !== authentication.accountId ||
        existing.snapshot.purpose !== command.purpose ||
        existing.snapshot.recordKind !== command.recordKind)
    )
      return new ExpenseCoverageConflictError("coverage replay conflicts")
    const previous = await repository.findLatest({
      freezeId: command.freezeId,
      recordKind: command.recordKind,
    })
    if (previous instanceof Error) return previous
    if (existing === null && previous?.snapshot.nextCursor === null)
      return new ExpenseCoverageConflictError("coverage scan already complete")
    const cursor =
      existing === null ? (previous?.snapshot.nextCursor ?? null) : existing.snapshot.afterCursor
    const reader = await new PrepareExpensePreservationReadAdapter(this.c).prepare({
      authentication,
      at: this.c.var.now(),
      permission: command.recordKind === "expense-budget" ? "budget:manage" : "expense:read:all",
    })
    if (reader instanceof ForbiddenError) return new ExpenseCoverageForbiddenError(reader.message)
    if (reader instanceof Error) return reader
    const page = await new CaptureFrozenExpenseRecordPageAdapter({
      env: this.c.env,
      var: this.c.var,
      now: this.c.var.now,
    }).prepare(
      {
        freezeId: command.freezeId,
        sourceNamespace: command.sourceNamespace,
        recordKind: command.recordKind,
        afterCursor: cursor,
        limit: command.recordKind === "expense-attachment" ? 1 : 10,
      },
      { authentication, session: reader.session },
    )
    if (page instanceof Error) return page
    const mappedIds = new Set(command.records.map((record) => String(record.sourceRecordId)))
    if (
      mappedIds.size !== command.records.length ||
      new Set(command.records.map((record) => record.preservedRecordId)).size !==
        command.records.length ||
      mappedIds.size !== page.records.length ||
      page.records.some((record) => !mappedIds.has(record.source.props.recordId)) ||
      (previous !== null && previous.snapshot.purpose !== command.purpose)
    )
      return new ExpenseCoverageConflictError("coverage mapping or purpose conflicts")
    const verified = await new PrepareExpenseCoverageRecordsAdapter({
      env: this.c.env,
      var: this.c.var,
      assertions: generation.assertions,
      sourceAssertions: () => page.assertions(this.c.var.now()),
    }).prepare({ records: page.records, mappings: command.records, purpose: command.purpose })
    if (verified instanceof Error) return verified
    const records = verified.records
    const finalRepository = verified.repository
    if (existing !== null) {
      if (JSON.stringify(existing.snapshot.records) !== JSON.stringify(records))
        return new ExpenseCoverageConflictError("coverage replay differs")
      const current = await finalRepository.find(existing.snapshot.id)
      if (current instanceof Error) return current
      if (current === null) return new Error("coverage receipt disappeared")
      return this.confirmTerminal(current, completion)
    }
    const verifiedPage = await RecordCoveragePageEntity.create(
      {
        id: command.id,
        freezeId: command.freezeId,
        sourceNamespace: command.sourceNamespace,
        ownerContext: "expense",
        recordKind: command.recordKind,
        purpose: command.purpose,
        sequence: (previous?.snapshot.sequence ?? 0) + 1,
        previousDigest: previous?.digest ?? null,
        afterCursor: cursor,
        nextCursor: page.nextCursor,
        checkedAt: this.c.var.now().toISOString(),
        actorAccountId: authentication.accountId,
        records,
      },
      previous,
    )
    if (verifiedPage instanceof Error) return verifiedPage
    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: "system.record.coverage.page.verified",
      targetType: "system:record-coverage-page",
      targetId: verifiedPage.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ purpose: command.purpose, freezeId: command.freezeId }),
      beforeJson: previous === null ? null : JSON.stringify(previous.snapshot),
      afterJson: JSON.stringify(verifiedPage.snapshot),
      metadataJson: null,
      occurredAt: new Date(verifiedPage.snapshot.checkedAt),
    })
    if (audit instanceof Error) return audit
    const saved = await finalRepository.append(verifiedPage, audit)
    if (saved instanceof Error) return saved
    if (saved === "conflict")
      return new ExpenseCoverageConflictError(
        "coverage page changed concurrently; retry the same operation",
      )
    return this.confirmTerminal(verifiedPage, completion)
  }

  private async confirmTerminal(
    page: RecordCoveragePageEntity,
    completion: ExpenseRecordSystemAdapter,
  ) {
    if (page.snapshot.nextCursor !== null) return page
    const verified = await completion.prepareKindCoverage({
      freezeId: page.snapshot.freezeId,
      sourceNamespace: page.snapshot.sourceNamespace,
      ownerContext: page.snapshot.ownerContext,
      recordKind: page.snapshot.recordKind,
      purpose: page.snapshot.purpose,
    })
    if (verified instanceof Error) return verified
    if (verified.summary.terminalDigest !== page.digest)
      return new ExpenseCoverageConflictError("coverage terminal page changed")
    return page
  }
}
