import { RegisterEmployee } from "@/application/employee/register-employee"
import { factory } from "@/lib/factory"
import { likeKeyword } from "@/interface/shared/like-keyword"
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
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"

export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      q: z.string().optional(),
      dept: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
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

    const rows = await c.var.database
      .select()
      .from(employees)
      .where(conditions.length === 0 ? undefined : and(...conditions))

    const responseBody = rows.map((row) => ({
      code: row.code,
      name: row.name,
      dept_name: row.deptName,
      position: row.position,
      email: row.email,
      status: row.status,
      role: row.role,
    }))

    return c.json(responseBody, 200)
  },
)

// POST /employees — 新規従業員の登録（権限が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      email: z.string().min(1),
      password: z.string().min(8),
      role: z.string().min(1),
      dept_id: z.number().int().nullable().optional(),
      dept_name: z.string().nullable().optional(),
      position: z.string().nullable().optional(),
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

      if (created.reason === "weak_password") {
        throw new BadRequestError("password must be at least 8 characters")
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
