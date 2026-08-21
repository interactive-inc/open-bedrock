import { RegisterEmployee } from "@/contexts/company/application/employee/register-employee"
import { factory } from "@/contexts/company/interface/utils/factory"
import { likeKeyword } from "@/contexts/company/interface/utils/like-keyword"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { resolveEmployeePositionName } from "@/contexts/company/interface/http/employees/resolve-employee-position-name"
import { positionRequiresDepartment } from "@/contexts/company/interface/utils/position-requires-department"
import { IdentityRepository } from "@/contexts/company/infrastructure/auth/identity.repository"
import { ApplicationError, UnexpectedError, UnprocessableError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zAppEmployee, zAppEmployeeList } from "@/lib/app-schemas"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, asc, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { codeSchema, employeeRoleSchema } from "@/lib/schemas"
import { listManagedEmployeeIds } from "@/contexts/company/infrastructure/organization/list-managed-employee-ids.repository"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { UnavailableError } from "@/lib/errors"
import { ReadOrganizationWorkforceState } from "@/contexts/company/infrastructure/workforce/read-organization-workforce-state.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import { requireCanonicalCompany } from "@/contexts/company/interface/utils/require-canonical-company"

function toCompatibilityStatus(state: WorkforceStateAt): "active" | "leave" | "retired" | null {
  if (state.status === "ACTIVE") return "active"
  if (state.status === "ON_LEAVE") return "leave"
  if (state.status === "TERMINATED") return "retired"
  return null
}

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      q: z.string().optional(),
      dept: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
      as_of: isoDate.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("employee:read") === false) {
      throw new ForbiddenError()
    }
    const query = c.req.valid("query")

    const resolvedDate =
      query.as_of ??
      resolveCompanyBusinessDate({
        now: c.env.NOW ?? new Date().toISOString(),
        timeZone: c.env.COMPANY_TIME_ZONE,
      })
    if (typeof resolvedDate !== "string") {
      throw toHttpException(
        new UnavailableError(
          "failed to resolve company business date",
          "company_timezone_unavailable",
          {
            cause: resolvedDate,
          },
        ),
      )
    }
    const asOf = restoreCalendarDate(resolvedDate)
    await requireCanonicalCompany(c, asOf)

    const conditions: Array<SQL> = []

    if (session.hasPermission("org:manage") === false) {
      const managedEmployeeIds = await listManagedEmployeeIds(c, session.employeeId, asOf)

      if (managedEmployeeIds instanceof Error) {
        throw new InternalError("failed to resolve employee organization scope")
      }

      conditions.push(
        inArray(employees.id, [...new Set([session.employeeId, ...managedEmployeeIds])]),
      )
    }

    if (query.q !== undefined) {
      const keywordMatch = or(
        likeKeyword(employees.name, query.q),
        likeKeyword(employees.code, query.q),
      )

      if (keywordMatch !== undefined) {
        conditions.push(keywordMatch)
      }
    }

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

    const snapshot = await new ReadOrganizationWorkforceState({
      organization: new OrganizationUnitReadRepository(c.var.database),
      workforce: new OrganizationWorkforceSnapshotRepository(c),
    }).execute(asOf)
    if (snapshot.kind !== "found") {
      throw toHttpException(
        new UnavailableError(
          "Company workforce is unavailable",
          snapshot.kind === "invalid"
            ? "company_workforce_invalid"
            : "company_workforce_unavailable",
          snapshot.kind === "unavailable" ? { cause: snapshot.cause } : undefined,
        ),
      )
    }
    conditions.push(isNull(employees.archivedAt))
    const candidates = await c.var.database
      .select({ id: employees.id, code: employees.code, name: employees.name })
      .from(employees)
      .where(and(...conditions))
      .orderBy(asc(employees.code))
    const stateByEmployeeId = new Map(snapshot.employees.map((state) => [state.employeeId, state]))
    const unitById = new Map(
      snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
    )
    const filtered = candidates.filter((row) => {
      const state = stateByEmployeeId.get(toWorkforceEmployeeId(row.id))
      const status = state === undefined ? null : toCompatibilityStatus(state)
      if (state === undefined || status === null) return false
      const departmentName =
        state.primaryAssignment === null
          ? null
          : (unitById.get(state.primaryAssignment.organizationUnitId)?.officialName ?? null)
      if (query.dept !== undefined && departmentName !== query.dept) return false
      return query.status === undefined || status === query.status
    })
    const page = filtered.slice(offset, offset + limit)
    const emailByEmployeeId = await new IdentityRepository(c).findEmailsByEmployeeIds(
      page.map((row) => row.id),
    )

    if (emailByEmployeeId instanceof Error) {
      throw toHttpException(
        new UnexpectedError("failed to resolve emails", { cause: emailByEmployeeId }),
      )
    }

    return c.json(
      zAppEmployeeList.parse({
        data: page.map((row) => {
          const state = stateByEmployeeId.get(toWorkforceEmployeeId(row.id))!
          const primary = state.primaryAssignment
          return {
            code: row.code,
            name: row.name,
            dept_name:
              primary === null
                ? null
                : (unitById.get(primary.organizationUnitId)?.officialName ?? null),
            position: primary?.positionTitle ?? null,
            email: emailByEmployeeId.get(row.id) ?? "",
            status: toCompatibilityStatus(state),
          }
        }),
        total: filtered.length,
      }),
      200,
    )
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /employees — 新規従業員の登録（権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.strictObject({
      code: codeSchema,
      name: z.string().min(1).max(200),
      email: z.string().email().max(254),
      password: z.string().min(12).max(200),
      role: employeeRoleSchema,
      hire_on: isoDate,
      department_code: codeSchema.nullable().optional(),
      position_code: codeSchema.nullable().optional(),
      manager_employee_code: codeSchema.nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    if (positionRequiresDepartment(json.department_code ?? null, json.position_code ?? null)) {
      throw toHttpException(
        new UnprocessableError(
          "役職は配属先部署とあわせて指定してください",
          "position_requires_department",
        ),
      )
    }

    const positionTitle = await resolveEmployeePositionName(c, json.position_code ?? null)

    if (positionTitle instanceof ApplicationError) {
      throw toHttpException(positionTitle)
    }

    const created = await new RegisterEmployee(c).run({
      session: session,
      employee: {
        code: json.code,
        name: json.name,
        email: json.email,
        password: json.password,
        role: json.role,
        hireOn: json.hire_on,
        departmentCode: json.department_code ?? null,
        positionTitle,
        managerEmployeeCode: json.manager_employee_code ?? null,
      },
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    // email/role は認証・認可情報(identities/account_roles)が正。登録時の入力値をそのまま返す。
    const responseBody = zAppEmployee.parse({
      code: created.code,
      name: created.name,
      dept_name: created.deptName,
      position: created.position,
      email: json.email,
      status: created.status,
      role: json.role,
    })

    return c.json(responseBody, 201)
  },
)
