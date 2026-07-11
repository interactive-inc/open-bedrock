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
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppEmployee, zAppEmployeeList } from "@/lib/app-schemas"
import { employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, asc, count, eq, or } from "drizzle-orm"
import { z } from "zod"
import { codeSchema, employeeRoleSchema } from "@/lib/schemas"
import { canReadEmployees } from "@/lib/employee/can-read-employees"

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
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canReadEmployees(session) === false) {
      throw new ForbiddenError()
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
