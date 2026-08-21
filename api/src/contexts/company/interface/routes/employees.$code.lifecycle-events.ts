import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { NotFoundError as ApplicationNotFoundError, UnexpectedError } from "@/lib/errors"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import { PersonnelActionRepository } from "@/contexts/company/infrastructure/employee-lifecycle/personnel-action.repository"
import { UnavailableError, ValidationError } from "@/lib/errors"
import { LifecycleCursor } from "@/lib/pagination/lifecycle-cursor"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { LifecycleAccess } from "@/contexts/company/interface/utils/lifecycle-access"
import { lifecycleNoStore } from "@/contexts/company/interface/middlewares/lifecycle-no-store"
import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { fingerprintLifecycleFilter } from "@/lib/pagination/fingerprint-lifecycle-filter"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const limit = z
  .string()
  .regex(/^(?:[1-9]|[1-9][0-9]|100)$/u)
  .optional()

const eventLimitSchema = z.number().int().min(1).max(100)

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(
  lifecycleNoStore,
  verifyBearer,
  zValidator(
    "query",
    z
      .object({
        from: isoDate.optional(),
        to: isoDate.optional(),
        limit,
        cursor: z.string().max(256).optional(),
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const employee = await (async () => {
      const command = {
        code: validateCodeParam(c.req.param("code"), "employee"),
      }

      const employeeRepository = new EmployeeRepository(c)

      const employee = await employeeRepository.findByCode(command.code)

      if (employee instanceof Error) {
        return new UnexpectedError("failed to find employee", { cause: employee })
      }

      if (employee === null) {
        return new ApplicationNotFoundError("employee not found", "employee_not_found")
      }

      return employee
    })()
    if (employee instanceof ApplicationError) throw new NotFoundError("employee not found")
    const authorization = await new LifecycleAccess({ c, session }).resolveReadAuthorization(
      employee.id,
    )
    if (authorization instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (authorization === null) {
      await new LifecycleAccess({ c, session }).appendDeniedAudit({
        targetEmployeeId: employee.id,
        permission: "employee:read",
        reasonCode: "lifecycle_scope_denied",
      })
      throw new NotFoundError("employee not found")
    }
    const query = c.req.valid("query")
    const result = await (async () => {
      const props = {
        employeeId: employee.id,
        from: query.from ?? null,
        to: query.to ?? null,
        limit: query.limit === undefined ? null : Number(query.limit),
        cursor: query.cursor ?? null,
      }

      if (
        (props.from !== null && !isoDate.safeParse(props.from).success) ||
        (props.to !== null && !isoDate.safeParse(props.to).success) ||
        (props.from !== null && props.to !== null && props.from > props.to)
      ) {
        return new ValidationError(
          "履歴の期間指定が不正です",
          "personnel_action_invalid_transition",
        )
      }

      const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
      if (migrationStatus instanceof ApplicationError) return migrationStatus
      if (migrationStatus !== "verified") {
        return new UnavailableError(
          "人事ライフサイクル移行が完了していません",
          "lifecycle_migration_incomplete",
        )
      }

      const decoded =
        props.cursor === null ? null : await LifecycleCursor.decode(props.cursor, c.env.JWT_SECRET)
      if (decoded instanceof ApplicationError) return decoded
      const limit = props.limit ?? decoded?.limit ?? 25
      if (!eventLimitSchema.safeParse(limit).success) {
        return new ValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor")
      }
      if (decoded !== null && decoded.limit !== limit) {
        return new ValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor")
      }

      const filterFingerprint = await fingerprintLifecycleFilter([
        props.employeeId,
        props.from,
        props.to,
      ])
      if (decoded !== null && decoded.filterFingerprint !== filterFingerprint) {
        return new ValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor")
      }

      const repository = new PersonnelActionRepository(c)
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
        now: c.env.NOW ?? new Date().toISOString(),
        timeZone: c.env.COMPANY_TIME_ZONE,
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
              c.env.JWT_SECRET,
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
    })()
    if (result instanceof ApplicationError) throw toHttpException(result)
    const filterFingerprint = await fingerprintLifecycleFilter([
      employee.id,
      query.from ?? null,
      query.to ?? null,
    ])
    await new LifecycleAccess({ c, session }).appendReadAudit({
      action: authorization.auditAction,
      targetEmployeeId: employee.id,
      scope: authorization.scope,
      resultCount: result.data.length,
      filterFingerprint,
    })
    return c.json(
      {
        data: result.data.map((event) => ({
          id: event.id,
          kind: event.kind,
          event_on: event.eventOn,
          recorded_at: new Date(event.recordedAt * 1_000).toISOString(),
          source_type: event.sourceType,
          source_application_id: event.sourceApplicationId,
          corrects_action_id: event.correctsActionId,
          display_status: event.displayStatus,
          summary: event.summary,
        })),
        next_cursor: result.nextCursor,
      },
      200,
    )
  },
)
