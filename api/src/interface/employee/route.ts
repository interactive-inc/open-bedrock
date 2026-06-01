import { factory } from "@/lib/factory"
import { likeKeyword } from "@/interface/shared/like-keyword"
import { verifyBearer } from "@/interface/shared/verify-bearer"
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
