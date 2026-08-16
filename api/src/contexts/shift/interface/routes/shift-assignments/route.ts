import { codeSchema } from "@/lib/schemas"
import { zAppShiftAssignmentList } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { orgDepartments } from "@/contexts/company/infrastructure/schema/organization"
import { shiftAssignments } from "@/contexts/shift/infrastructure/schema/shift"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, count, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"

// @authorization permission - 権限キーで判定する
/** GET /shift-assignments — 特権ロールが部署単位でシフトを横断検索する */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      dept_code: codeSchema.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("shift:manage") === false) {
      throw new ForbiddenError()
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

    const conditions: Array<SQL> = []

    if (query.from !== undefined) {
      conditions.push(gte(shiftAssignments.date, query.from))
    }

    if (query.to !== undefined) {
      conditions.push(lte(shiftAssignments.date, query.to))
    }

    if (query.dept_code !== undefined) {
      const departments = await c.var.database
        .select({ departmentId: orgDepartments.departmentId })
        .from(orgDepartments)
        .where(eq(orgDepartments.code, query.dept_code))
        .limit(1)

      const department = departments.at(0)

      if (department === undefined) {
        return c.json(zAppShiftAssignmentList.parse({ data: [], total: 0 }), 200)
      }

      conditions.push(eq(employees.deptId, department.departmentId))
    }

    const rows = await c.var.database
      .select({ assignment: shiftAssignments })
      .from(shiftAssignments)
      .leftJoin(employees, eq(employees.id, shiftAssignments.employeeId))
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(shiftAssignments.id)
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(shiftAssignments)
      .leftJoin(employees, eq(employees.id, shiftAssignments.employeeId))
      .where(conditions.length === 0 ? undefined : and(...conditions))

    const responseBody = zAppShiftAssignmentList.parse({
      data: rows.map((row) => ({
        id: row.assignment.id,
        employee_id: row.assignment.employeeId,
        pattern_id: row.assignment.patternId,
        date: row.assignment.date,
        note: row.assignment.note,
        published_at: row.assignment.publishedAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
