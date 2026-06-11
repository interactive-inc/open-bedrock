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
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, asc, count, eq, or } from "drizzle-orm"
import { z } from "zod"
import { codeSchema, employeeRoleSchema } from "@/lib/schemas"

export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      q: z.string().optional(),
      dept: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query")

    const conditions: Array<SQL> = []

    if (query.q !== undefined) {
      const keywordMatch = or(
        likeKeyword(employees.name, query.q),
        likeKeyword(employees.code, query.q),
        likeKeyword(employees.email, query.q),
      )

      if (keywordMatch !== undefined) {
        conditions.push(keywordMatch)
      }
    }

    if (query.dept !== undefined) {
      conditions.push(eq(employees.deptName, query.dept))
    }

    if (query.status !== undefined) {
      conditions.push(eq(employees.status, query.status))
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

    const rows = await c.var.database
      .select({
        code: employees.code,
        name: employees.name,
        deptName: employees.deptName,
        position: employees.position,
        email: employees.email,
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

    const responseBody = rows.map((row) => ({
      code: row.code,
      name: row.name,
      dept_name: row.deptName,
      position: row.position,
      email: row.email,
      status: row.status,
    }))

    return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
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
      viewerRole: session.role,
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

    if (created instanceof Error) {
      throw new InternalError("failed to create employee")
    }

    if ("reason" in created) {
      if (created.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (created.reason === "role_escalation_forbidden") {
        throw new ForbiddenError("only admin can assign non-member roles")
      }

      if (created.reason === "weak_password") {
        throw new BadRequestError("password must be at least 8 characters")
      }

      if (created.reason === "email_conflict") {
        throw new ConflictError("email already exists")
      }

      throw new ConflictError("employee code already exists")
    }

    const responseBody = {
      code: created.code,
      name: created.name,
      dept_name: created.deptName,
      position: created.position,
      email: created.email,
      status: created.status,
      role: created.role,
    }

    return c.json(responseBody, 201)
  },
)
