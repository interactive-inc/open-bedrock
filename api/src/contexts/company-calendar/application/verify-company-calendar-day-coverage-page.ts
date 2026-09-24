import { CompanyCalendarDayRecordSystemAdapter } from "@/contexts/company-calendar/infrastructure/adapters/company-calendar-day-record-system.adapter"
import {
  CompanyCalendarDayCoverageForbiddenError,
  CompanyCalendarDayCoverageConflictError,
} from "@/contexts/company-calendar/application/errors"
import { companyCalendarDayCoveragePageCommandSchema } from "@/contexts/company-calendar/domain/schemas/company-calendar-coverage-page-command.schema"
import type { CompanyCalendarDayContext } from "@/contexts/company-calendar/configuration/company-calendar-context"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CaptureFrozenCompanyCalendarDayRecordPageAdapter } from "@/contexts/company-calendar/infrastructure/adapters/capture-frozen-company-calendar-record-page.adapter"
import { PrepareCompanyCalendarDayCoverageRecordsAdapter } from "@/contexts/company-calendar/infrastructure/adapters/prepare-company-calendar-coverage-records.adapter"

type Context = CompanyCalendarDayContext & SystemDatabaseContext & SystemAttachmentStorageContext

/** 保存済みの続きから会社カレンダー記録の原文を照合し、同じ停止世代のページと監査を保存する。 */
export class VerifyCompanyCalendarDayCoveragePage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string): Promise<RecordCoveragePageEntity | Error> {
    const parsed = companyCalendarDayCoveragePageCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new CompanyCalendarDayCoverageForbiddenError("coverage authentication required")
    const proof = await new CompanyCalendarDayRecordSystemAdapter(
      this.c,
    ).prepareSourceFreezeAuthorization({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (proof instanceof Error) return proof
    if (proof === "forbidden")
      return new CompanyCalendarDayCoverageForbiddenError("coverage authorization denied")
    const generation = await new CompanyCalendarDayRecordSystemAdapter({
      env: this.c.env,
      assertions: proof.assertions,
    })
      .sourceFreezes()
      .prepareActiveGeneration({
        id: command.freezeId,
        sourceNamespace: command.sourceNamespace,
        ownerContext: "company-calendar",
      })
    if (generation instanceof Error) return generation
    const completion = new CompanyCalendarDayRecordSystemAdapter({
      env: this.c.env,
      assertions: generation.assertions,
    })
    const repository = new CompanyCalendarDayRecordSystemAdapter({
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
        existing.snapshot.recordKind !== "company-calendar-record")
    )
      return new CompanyCalendarDayCoverageConflictError("coverage replay conflicts")
    const previous = await repository.findLatest({
      freezeId: command.freezeId,
      recordKind: "company-calendar-record",
    })
    if (previous instanceof Error) return previous
    if (existing === null && previous?.snapshot.nextCursor === null)
      return new CompanyCalendarDayCoverageConflictError("coverage scan already complete")
    const cursor =
      existing === null ? (previous?.snapshot.nextCursor ?? null) : existing.snapshot.afterCursor
    if (cursor !== null && !/^(0|-?[1-9][0-9]*)$/.test(cursor))
      return new Error("invalid stored coverage cursor")
    const page = await new CaptureFrozenCompanyCalendarDayRecordPageAdapter(this.c).prepare({
      freezeId: command.freezeId,
      sourceNamespace: command.sourceNamespace,
      afterId: cursor === null ? null : Number(cursor),
      limit: 10,
    })
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
      return new CompanyCalendarDayCoverageConflictError("coverage mapping or purpose conflicts")
    const verified = await new PrepareCompanyCalendarDayCoverageRecordsAdapter({
      env: this.c.env,
      var: this.c.var,
      assertions: generation.assertions,
    }).prepare({ records: page.records, mappings: command.records, purpose: command.purpose })
    if (verified instanceof Error) return verified
    const records = verified.records
    const finalRepository = verified.repository
    if (existing !== null) {
      if (JSON.stringify(existing.snapshot.records) !== JSON.stringify(records))
        return new CompanyCalendarDayCoverageConflictError("coverage replay differs")
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
        ownerContext: "company-calendar",
        recordKind: "company-calendar-record",
        purpose: command.purpose,
        sequence: (previous?.snapshot.sequence ?? 0) + 1,
        previousDigest: previous?.digest ?? null,
        afterCursor: cursor,
        nextCursor: page.nextAfterId === null ? null : String(page.nextAfterId),
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
      return new CompanyCalendarDayCoverageConflictError(
        "coverage page changed concurrently; retry the same operation",
      )
    return this.confirmTerminal(verifiedPage, completion)
  }

  private async confirmTerminal(
    page: RecordCoveragePageEntity,
    completion: CompanyCalendarDayRecordSystemAdapter,
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
      return new CompanyCalendarDayCoverageConflictError("coverage terminal page changed")
    return page
  }
}
