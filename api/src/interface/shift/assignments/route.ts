import { canManageShift } from "@/domain/shift/can-manage-shift"
import { codeSchema } from "@/lib/schemas"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, orgDepartments, shiftAssignments } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"

// GET /shift/assignments — 特権ロールが部署単位でシフトを横断検索する
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

    if (canManageShift(session.role) === false) {
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
        return c.json([], 200)
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

    const responseBody = rows.map((row) => ({
      id: row.assignment.id,
      employee_id: row.assignment.employeeId,
      pattern_id: row.assignment.patternId,
      date: row.assignment.date,
      note: row.assignment.note,
      published_at: row.assignment.publishedAt,
    }))

    return c.json(responseBody, 200)
  },
)
