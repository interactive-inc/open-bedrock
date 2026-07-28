import type { PersonnelActionSummary } from "@/domain/employee-lifecycle/project-personnel-action"
import type { PersonnelActionKind } from "@/domain/employee-lifecycle/lifecycle-types"
import type { Context } from "@/env"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { PersonnelActionRepository } from "@/infrastructure/employee-lifecycle/personnel-action-repository"
import { ApplicationError, UnavailableError, ValidationError } from "@/lib/errors"
import { LifecycleCursor } from "@/lib/pagination/lifecycle-cursor"
import { fingerprintLifecycleFilter } from "@/lib/pagination/fingerprint-lifecycle-filter"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { z } from "zod"

const limitSchema = z.number().int().min(1).max(100)

export type LifecycleEvent = {
  id: string
  kind: PersonnelActionKind
  eventOn: string
  recordedAt: number
  sourceType: "application" | "direct" | "migration" | "system"
  sourceApplicationId: number | null
  correctsActionId: string | null
  displayStatus: "confirmed" | "scheduled" | "corrected" | "correction" | "migration"
  summary: PersonnelActionSummary
}

export type LifecycleEventPage = {
  data: ReadonlyArray<LifecycleEvent>
  nextCursor: string | null
}

function invalidCursor(cause?: unknown): ValidationError {
  return new ValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor", { cause })
}

export class ListLifecycleEvents {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: {
    employeeId: number
    from: string | null
    to: string | null
    limit: number | null
    cursor: string | null
  }): Promise<LifecycleEventPage | ApplicationError> {
    if (
      (props.from !== null && !isoDate.safeParse(props.from).success) ||
      (props.to !== null && !isoDate.safeParse(props.to).success) ||
      (props.from !== null && props.to !== null && props.from > props.to)
    ) {
      return new ValidationError("履歴の期間指定が不正です", "personnel_action_invalid_transition")
    }

    const migrationStatus = await new EmployeeLifecycleRepository(this.c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) return migrationStatus
    if (migrationStatus !== "verified") {
      return new UnavailableError(
        "人事ライフサイクル移行が完了していません",
        "lifecycle_migration_incomplete",
      )
    }

    const decoded =
      props.cursor === null
        ? null
        : await LifecycleCursor.decode(props.cursor, this.c.env.JWT_SECRET)
    if (decoded instanceof ApplicationError) return decoded
    const limit = props.limit ?? decoded?.limit ?? 25
    if (!limitSchema.safeParse(limit).success) return invalidCursor()
    if (decoded !== null && decoded.limit !== limit) return invalidCursor()

    const filterFingerprint = await fingerprintLifecycleFilter([
      props.employeeId,
      props.from,
      props.to,
    ])
    if (decoded !== null && decoded.filterFingerprint !== filterFingerprint) {
      return invalidCursor()
    }

    const repository = new PersonnelActionRepository(this.c)
    const anchorRowId =
      decoded?.anchorRowId ??
      (await repository.maxRowIdForEmployee({
        employeeId: props.employeeId,
        from: props.from,
        to: props.to,
      }))
    if (anchorRowId instanceof ApplicationError) return anchorRowId
    const rows = await repository.listForEmployee({
      employeeId: props.employeeId,
      from: props.from,
      to: props.to,
      anchorRowId,
      position: decoded?.position ?? null,
      limit: limit + 1,
    })
    if (rows instanceof ApplicationError) return rows

    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new UnavailableError("会社営業日を解決できません", "company_timezone_unavailable", {
        cause: businessDate,
      })
    }

    const page = rows.slice(0, limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length <= limit || last === undefined
        ? null
        : await LifecycleCursor.encode(
            {
              version: 1,
              filterFingerprint,
              anchorRowId,
              position: { eventOn: last.eventOn, recordedAt: last.recordedAt, id: last.id },
              limit,
            },
            this.c.env.JWT_SECRET,
          )

    return {
      data: page.map((row) => ({
        id: row.id,
        kind: row.kind,
        eventOn: row.eventOn,
        recordedAt: row.recordedAt,
        sourceType: row.sourceType,
        sourceApplicationId: row.sourceApplicationId,
        correctsActionId: row.correctsActionId,
        displayStatus:
          row.kind === "corrected"
            ? "correction"
            : row.corrected
              ? "corrected"
              : row.kind === "legacy_baseline"
                ? "migration"
                : row.eventOn > businessDate
                  ? "scheduled"
                  : "confirmed",
        summary: row.summary,
      })),
      nextCursor,
    }
  }
}
