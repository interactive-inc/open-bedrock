import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { likeKeyword } from "@/interface/utils/like-keyword"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError, UnavailableError } from "@/lib/errors"
import { zAppEmployeeDirectoryList } from "@/lib/app-schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { employees, employeeStatusPeriodVersions } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, asc, count, eq, exists, inArray, isNull, lte, or, sql } from "drizzle-orm"
import { z } from "zod"

/**
 * GET /directory/employees — 選択UI向けの在籍者ディレクトリ。
 * 全認証ユーザーが利用できるが、メール・在籍区分・ロール・内部IDは返さない。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      q: z.string().optional(),
      dept: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    if (c.var.session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const conditions: Array<SQL> = []

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
      const businessDate = resolveCompanyBusinessDate({
        now: c.env.NOW ?? new Date().toISOString(),
        timeZone: c.env.COMPANY_TIME_ZONE,
      })
      if (typeof businessDate !== "string") {
        throw toHttpException(
          new UnavailableError(
            "failed to resolve company business date",
            "company_timezone_unavailable",
            { cause: businessDate },
          ),
        )
      }

      // Pre-filter at the DB level: exclude archived employees and use a subquery
      // on employee_status_period_versions to select only those with a current
      // active status period. This avoids loading all employees into memory.
      conditions.push(isNull(employees.archivedAt))
      const spv = employeeStatusPeriodVersions
      conditions.push(
        exists(
          c.var.database
            .select({ one: sql`1` })
            .from(spv)
            .where(
              and(
                eq(spv.employeeId, employees.id),
                eq(spv.isVoid, false),
                sql`${spv.revision} = (SELECT MAX(c.revision) FROM employee_status_period_versions c WHERE c.period_id = ${spv.periodId})`,
                inArray(spv.status, ["active"]),
                lte(spv.startsOn, businessDate),
                or(isNull(spv.endsOn), sql`${spv.endsOn} > ${businessDate}`),
              ),
            ),
        ),
      )
      const candidates = await c.var.database
        .select({ id: employees.id, code: employees.code, name: employees.name })
        .from(employees)
        .where(and(...conditions))
        .orderBy(asc(employees.code))
      const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
        candidates.map((employee) => employee.id),
        businessDate,
      )
      if (states instanceof ApplicationError) throw toHttpException(states)

      const active = candidates.flatMap((employee) => {
        const state = states.get(employee.id)
        if (state === undefined || state.archived || state.status !== "active") return []
        const assignment = state.primaryAssignment
        if (query.dept !== undefined && assignment?.departmentName !== query.dept) return []
        return [
          {
            code: employee.code,
            name: employee.name,
            dept_name: assignment?.departmentName ?? null,
            position: assignment?.positionTitle ?? null,
          },
        ]
      })

      return c.json(
        zAppEmployeeDirectoryList.parse({
          data: active.slice(offset, offset + limit),
          total: active.length,
        }),
        200,
      )
    }

    conditions.push(eq(employees.status, "active"))

    if (query.dept !== undefined) {
      conditions.push(eq(employees.deptName, query.dept))
    }

    const rows = await c.var.database
      .select({
        code: employees.code,
        name: employees.name,
        deptName: employees.deptName,
        position: employees.position,
      })
      .from(employees)
      .where(and(...conditions))
      .orderBy(asc(employees.code))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(employees)
      .where(and(...conditions))

    return c.json(
      zAppEmployeeDirectoryList.parse({
        data: rows.map((row) => ({
          code: row.code,
          name: row.name,
          dept_name: row.deptName,
          position: row.position,
        })),
        total: totalRows.at(0)?.total ?? 0,
      }),
      200,
    )
  },
)
