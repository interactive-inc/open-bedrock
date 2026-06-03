import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte employee update <code> --name <n> --email <e> --role <r> --status active|leave|retired [--dept-id <n>] [--dept-name <d>] [--position <p>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      role: z.string().optional(),
      "dept-id": z.coerce.number().int().optional(),
      "dept-name": z.string().optional(),
      position: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
    }),
  ),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <code> が必要です")

    if (!query.name || !query.email || !query.role || !query.status)
      throw new UsageError("--name, --email, --role, --status が必要です")

    const payload = {
      name: query.name,
      email: query.email,
      role: query.role,
      dept_id: query["dept-id"] ?? null,
      dept_name: query["dept-name"] ?? null,
      position: query.position ?? null,
      status: query.status,
    }

    const client = await createClient()

    const response = await client.employees[":code"].$put({
      param: { code: employeeCode },
      json: payload,
    })

    return c.json(await response.json())
  },
)
