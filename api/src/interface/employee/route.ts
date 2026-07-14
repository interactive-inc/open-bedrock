import { RegisterEmployee } from "@/application/employee/register-employee"
import { factory } from "@/lib/factory"
import { likeKeyword } from "@/interface/shared/like-keyword"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppEmployee, zAppEmployeeList } from "@/lib/app-schemas"
import { employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, asc, count, eq, inArray, or } from "drizzle-orm"
import { z } from "zod"
import { codeSchema, employeeRoleSchema } from "@/lib/schemas"
import { canReadEmployees } from "@/lib/employee/can-read-employees"
import { hasPermission } from "@/lib/auth/has-permission"
import { listManagedEmployeeIds } from "@/lib/org/organization-authority"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/company-business-date"
import { UnavailableError } from "@/lib/errors"

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

    if (canReadEmployees(session) === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const conditions: Array<SQL> = []

    if (hasPermission(session, "org:manage") === false) {
      const managedEmployeeIds = await listManagedEmployeeIds(c, session.employeeId)

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

    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) throw toHttpException(migrationStatus)

    if (migrationStatus === "verified") {
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
            { cause: resolvedDate },
          ),
        )
      }
      const candidates = await c.var.database
        .select({ id: employees.id, code: employees.code, name: employees.name })
        .from(employees)
        .where(conditions.length === 0 ? undefined : and(...conditions))
        .orderBy(asc(employees.code))
      const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
        candidates.map((row) => row.id),
        resolvedDate,
      )
      if (states instanceof ApplicationError) throw toHttpException(states)
      const filtered = candidates.filter((row) => {
        const state = states.get(row.id)
        if (state === undefined || state.archived || state.status === "prehire") return false
        if (query.dept !== undefined && state.primaryAssignment?.departmentName !== query.dept) {
          return false
        }
        return query.status === undefined || state.status === query.status
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
            const state = states.get(row.id)
            return {
              code: row.code,
              name: row.name,
              dept_name: state?.primaryAssignment?.departmentName ?? null,
              position: state?.primaryAssignment?.positionTitle ?? null,
              email: emailByEmployeeId.get(row.id) ?? "",
              status: state?.status ?? "retired",
            }
          }),
          total: filtered.length,
        }),
        200,
      )
    }

    if (query.dept !== undefined) {
      conditions.push(eq(employees.deptName, query.dept))
    }

    if (query.status !== undefined) {
      conditions.push(eq(employees.status, query.status))
    }

    const rows = await c.var.database
      .select({
        id: employees.id,
        code: employees.code,
        name: employees.name,
        deptName: employees.deptName,
        position: employees.position,
        status: employees.status,
      })
      .from(employees)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(asc(employees.code))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(employees)
      .where(conditions.length === 0 ? undefined : and(...conditions))

    // email は認証情報(identities)が正。台帳の表示用に id で解決する。
    const emailByEmployeeId = await new IdentityRepository(c).findEmailsByEmployeeIds(
      rows.map((row) => row.id),
    )

    if (emailByEmployeeId instanceof Error) {
      throw toHttpException(
        new UnexpectedError("failed to resolve emails", { cause: emailByEmployeeId }),
      )
    }

    const responseBody = zAppEmployeeList.parse({
      data: rows.map((row) => ({
        code: row.code,
        name: row.name,
        dept_name: row.deptName,
        position: row.position,
        email: emailByEmployeeId.get(row.id) ?? "",
        status: row.status,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)

// POST /employees — 新規従業員の登録（権限が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(200),
      email: z.string().email().max(254),
      password: z.string().min(8).max(200),
      role: employeeRoleSchema,
      dept_id: z.number().int().nullable().optional(),
      dept_name: z.string().max(200).nullable().optional(),
      position: z.string().max(200).nullable().optional(),
      status: z.enum(["active", "leave", "retired"]),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterEmployee(c).run({
      session: session,
      employee: {
        code: json.code,
        name: json.name,
        email: json.email,
        password: json.password,
        role: json.role,
        deptId: json.dept_id ?? null,
        deptName: json.dept_name ?? null,
        position: json.position ?? null,
        status: json.status,
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
