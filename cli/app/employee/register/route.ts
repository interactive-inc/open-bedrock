import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte employee register --code <c> --name <n> --email <e> --password <p> --role <r> --status active|leave|retired [--dept-id <n>] [--dept-name <d>] [--position <p>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      role: z.enum(["admin", "member", "manager", "hr"]).optional(),
      "dept-id": z.coerce.number().int().optional(),
      "dept-name": z.string().optional(),
      position: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (
      !query.code ||
      !query.name ||
      !query.email ||
      !query.password ||
      !query.role ||
      !query.status
    )
      throw new UsageError("--code, --name, --email, --password, --role, --status が必要です")

    const payload = {
      code: query.code,
      name: query.name,
      email: query.email,
      password: query.password,
      role: query.role,
      dept_id: query["dept-id"] ?? null,
      dept_name: query["dept-name"] ?? null,
      position: query.position ?? null,
      status: query.status,
    }

    const client = await createClient()

    const response = await client.employees.$post({ json: payload })

    return c.json(await response.json())
  },
)
