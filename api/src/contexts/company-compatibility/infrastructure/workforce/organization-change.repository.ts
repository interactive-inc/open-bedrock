import type {
  OrganizationChangeReplayReadResult,
  OrganizationChangeSet,
  OrganizationChangeWritePort,
  OrganizationChangeWriteResult,
} from "@/contexts/company/application/workforce/apply-organization-change"
import { toOrganizationChangeFingerprint } from "@/contexts/company-compatibility/infrastructure/workforce/to-organization-change-fingerprint"
import {
  organizationAssignmentPeriodVersions,
  organizationResponsibilityPeriodVersions,
  organizationChangeOperations,
  organizationLifecycleStates,
  organizationUnitPeriodVersions,
  organizationUnits,
} from "@/contexts/company-compatibility/infrastructure/schema/organization"
import { eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import type { DrizzleD1Database } from "drizzle-orm/d1"

type OrganizationWriteDatabase = Pick<
  DrizzleD1Database<{
    organizationAssignmentPeriodVersions: typeof organizationAssignmentPeriodVersions
    organizationResponsibilityPeriodVersions: typeof organizationResponsibilityPeriodVersions
    organizationChangeOperations: typeof organizationChangeOperations
    organizationLifecycleStates: typeof organizationLifecycleStates
    organizationUnitPeriodVersions: typeof organizationUnitPeriodVersions
    organizationUnits: typeof organizationUnits
  }>,
  "batch" | "insert" | "select" | "update"
>

function date(timestamp: number): Date {
  return new Date(timestamp)
}

/** expected revision guardから完了markまでをD1の一回のatomic batchへまとめる。 */
export class OrganizationChangeRepository implements OrganizationChangeWritePort {
  constructor(private readonly database: OrganizationWriteDatabase) {
    Object.freeze(this)
  }

  private async revision(): Promise<number> {
    const rows = await this.database
      .select({ revision: organizationLifecycleStates.revision })
      .from(organizationLifecycleStates)
      .where(eq(organizationLifecycleStates.id, 1))
      .limit(1)
    const revision = rows[0]?.revision
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new Error("organization lifecycle state is missing or invalid")
    }
    return revision
  }

  async findReplay(change: OrganizationChangeSet): Promise<OrganizationChangeReplayReadResult> {
    try {
      const requestFingerprint = await toOrganizationChangeFingerprint(change)
      const rows = await this.database
        .select({
          requestFingerprint: organizationChangeOperations.requestFingerprint,
          resultingRevision: organizationChangeOperations.resultingRevision,
          status: organizationChangeOperations.status,
        })
        .from(organizationChangeOperations)
        .where(eq(organizationChangeOperations.id, change.operationId))
        .limit(1)
      const operation = rows[0]
      if (operation === undefined) return { ok: true, kind: "not_found" }
      if (operation.requestFingerprint !== requestFingerprint) {
        return { ok: false, kind: "operation_conflict" }
      }
      return operation.status === "COMPLETED"
        ? { ok: true, kind: "replayed", revision: operation.resultingRevision }
        : {
            ok: false,
            kind: "unavailable",
            cause: new Error("organization change operation is incomplete"),
          }
    } catch (cause) {
      return { ok: false, kind: "unavailable", cause }
    }
  }

  async append(change: OrganizationChangeSet): Promise<OrganizationChangeWriteResult> {
    const changeCount =
      change.unitPeriods.length + change.assignments.length + change.responsibilities.length
    const resultingRevision = change.expectedRevision + changeCount
    const statements: BatchItem<"sqlite">[] = [
      this.database.insert(organizationChangeOperations).values({
        id: change.operationId,
        expectedRevision: change.expectedRevision,
        changeCount,
        appliedCount: 0,
        resultingRevision,
        status: "PENDING",
        recordedAt: date(change.recordedAt),
        actorAccountId: change.actorAccountId,
        reason: change.reason,
        evidenceReferencesJson: JSON.stringify(change.evidenceReferences),
        requestFingerprint: await toOrganizationChangeFingerprint(change),
      }),
    ]

    if (change.organizationUnits.length > 0) {
      statements.push(
        this.database.insert(organizationUnits).values(
          change.organizationUnits.map((unit) => ({
            id: unit.id,
            createdAt: date(unit.createdAt),
          })),
        ),
      )
    }
    for (const period of change.unitPeriods) {
      statements.push(
        this.database.insert(organizationUnitPeriodVersions).values({
          ...period,
          recordedAt: date(period.recordedAt),
        }),
      )
    }
    for (const period of change.assignments) {
      statements.push(
        this.database.insert(organizationAssignmentPeriodVersions).values({
          ...period,
          recordedAt: date(period.recordedAt),
        }),
      )
    }
    for (const period of change.responsibilities) {
      statements.push(
        this.database.insert(organizationResponsibilityPeriodVersions).values({
          ...period,
          recordedAt: date(period.recordedAt),
        }),
      )
    }
    statements.push(
      this.database
        .update(organizationChangeOperations)
        .set({ status: "COMPLETED" })
        .where(eq(organizationChangeOperations.id, change.operationId)),
    )

    try {
      await this.database.batch([statements[0]!, ...statements.slice(1)])
      return { ok: true, revision: resultingRevision, replayed: false }
    } catch (cause) {
      const replay = await this.findReplay(change)
      if (replay.ok && replay.kind === "replayed") {
        return { ok: true, revision: replay.revision, replayed: true }
      }
      if (!replay.ok && replay.kind === "operation_conflict") {
        return { ok: false, kind: "operation_conflict" }
      }
      try {
        const actualRevision = await this.revision()
        if (actualRevision !== change.expectedRevision) {
          return { ok: false, kind: "conflict", actualRevision }
        }
      } catch {
        // 元のwrite errorを返す。error分類用readも失敗した場合に上書きしない。
      }
      return { ok: false, kind: "unavailable", cause }
    }
  }
}
