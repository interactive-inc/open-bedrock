import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { likeKeyword } from "@/contexts/company-compatibility/interface/utils/like-keyword"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { UnavailableError } from "@/lib/errors"
import { zAppEmployeeDirectoryList } from "@/lib/app-schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { employees } from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, asc, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { ReadOrganizationWorkforceState } from "@/contexts/company/application/workforce/read-organization-workforce-state"
import { toWorkforceEmployeeId } from "@/contexts/company-compatibility/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { OrganizationUnitReadRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-workforce-snapshot.repository"
import { requireCanonicalCompany } from "@/contexts/company-compatibility/interface/utils/require-canonical-company"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
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

    const businessDate = resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      throw toHttpException(
        new UnavailableError(
          "failed to resolve company business date",
          "company_timezone_unavailable",
          {
            cause: businessDate,
          },
        ),
      )
    }
    const asOf = restoreCalendarDate(businessDate)
    await requireCanonicalCompany(c, asOf)
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
    const active = candidates.flatMap((employee) => {
      const state = stateByEmployeeId.get(toWorkforceEmployeeId(employee.id))
      if (state?.status !== "ACTIVE") return []
      const assignment = state.primaryAssignment
      const departmentName =
        assignment === null
          ? null
          : (unitById.get(assignment.organizationUnitId)?.officialName ?? null)
      if (query.dept !== undefined && departmentName !== query.dept) return []
      return [
        {
          code: employee.code,
          name: employee.name,
          dept_name: departmentName,
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
  },
)
