import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"
import {
  HealthCheckupCoverageForbiddenError,
  HealthCheckupCoverageConflictError,
} from "@/contexts/health-checkup/application/errors"
import { healthCheckupCoveragePageCommandSchema } from "@/contexts/health-checkup/domain/schemas/health-checkup-coverage-page-command.schema"
import type { HealthCheckupContext } from "@/contexts/health-checkup/configuration/health-checkup-context"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CaptureFrozenHealthCheckupRecordPageAdapter } from "@/contexts/health-checkup/infrastructure/adapters/capture-frozen-health-checkup-record-page.adapter"
import { PrepareHealthCheckupCoverageRecordsAdapter } from "@/contexts/health-checkup/infrastructure/adapters/prepare-health-checkup-coverage-records.adapter"

type Context = HealthCheckupContext &
  SystemDatabaseContext &
  SystemAttachmentStorageContext

/** 保存済みの続きから健康診断実施記録の原文を照合し、同じ停止世代のページと監査を保存する。 */
export class VerifyHealthCheckupCoveragePage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string): Promise<RecordCoveragePageEntity | Error> {
    const parsed = healthCheckupCoveragePageCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new HealthCheckupCoverageForbiddenError("coverage authentication required")
    const proof = await new PrepareRecordSourceFreezeAuthorizationAdapter(this.c).prepare({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (proof instanceof Error) return proof
    if (proof === "forbidden")
      return new HealthCheckupCoverageForbiddenError("coverage authorization denied")
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: proof.assertions,
    }).prepareActiveGeneration({
      id: command.freezeId,
      sourceNamespace: command.sourceNamespace,
      ownerContext: "health-checkup",
    })
    if (generation instanceof Error) return generation
    const completion = new PrepareRecordKindCoverageAdapter({
      env: this.c.env,
      assertions: generation.assertions,
    })
    const repository = new RecordCoveragePageRepository({
      env: this.c.env,
      assertions: generation.assertions,
    })
    const existing = await repository.find(command.id)
    if (existing instanceof Error) return existing
    if (
      existing !== null &&
      (existing.snapshot.freezeId !== command.freezeId ||
        existing.snapshot.actorAccountId !== authentication.accountId ||
        existing.snapshot.purpose !== command.purpose ||
        existing.snapshot.recordKind !== "health-checkup-record")
    )
      return new HealthCheckupCoverageConflictError("coverage replay conflicts")
    const previous = await repository.findLatest({
      freezeId: command.freezeId,
      recordKind: "health-checkup-record",
    })
    if (previous instanceof Error) return previous
    if (existing === null && previous?.snapshot.nextCursor === null)
      return new HealthCheckupCoverageConflictError("coverage scan already complete")
    const cursor =
      existing === null ? (previous?.snapshot.nextCursor ?? null) : existing.snapshot.afterCursor
    if (cursor !== null && !/^[1-9][0-9]*$/.test(cursor))
      return new Error("invalid stored coverage cursor")
    const page = await new CaptureFrozenHealthCheckupRecordPageAdapter(this.c).prepare({
      freezeId: command.freezeId,
      sourceNamespace: command.sourceNamespace,
      afterId: cursor === null ? 0 : Number(cursor),
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
      return new HealthCheckupCoverageConflictError("coverage mapping or purpose conflicts")
    const verified = await new PrepareHealthCheckupCoverageRecordsAdapter({
      env: this.c.env,
      var: this.c.var,
      assertions: generation.assertions,
    }).prepare({ records: page.records, mappings: command.records, purpose: command.purpose })
    if (verified instanceof Error) return verified
    const records = verified.records
    const finalRepository = verified.repository
    if (existing !== null) {
      if (JSON.stringify(existing.snapshot.records) !== JSON.stringify(records))
        return new HealthCheckupCoverageConflictError("coverage replay differs")
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
        ownerContext: "health-checkup",
        recordKind: "health-checkup-record",
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
      return new HealthCheckupCoverageConflictError(
        "coverage page changed concurrently; retry the same operation",
      )
    return this.confirmTerminal(verifiedPage, completion)
  }

  private async confirmTerminal(
    page: RecordCoveragePageEntity,
    completion: PrepareRecordKindCoverageAdapter,
  ) {
    if (page.snapshot.nextCursor !== null) return page
    const verified = await completion.prepare({
      freezeId: page.snapshot.freezeId,
      sourceNamespace: page.snapshot.sourceNamespace,
      ownerContext: page.snapshot.ownerContext,
      recordKind: page.snapshot.recordKind,
      purpose: page.snapshot.purpose,
    })
    if (verified instanceof Error) return verified
    if (verified.summary.terminalDigest !== page.digest)
      return new HealthCheckupCoverageConflictError("coverage terminal page changed")
    return page
  }
}
