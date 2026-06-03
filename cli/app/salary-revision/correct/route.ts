import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte salary-revision correct --id <n> --effective <date> --new-base-salary <amount> [--reason <r>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      effective: z.string().optional(),
      "new-base-salary": z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.effective || !query["new-base-salary"]) {
      throw new UsageError("--id, --effective, --new-base-salary が必要です")
    }

    const client = await createClient()

    const response = await client["salary-revisions"][":id"].$put({
      param: { id: query.id },
      json: {
        effective_date: query.effective,
        new_base_salary: Number(query["new-base-salary"]),
        reason: query.reason ?? null,
      },
    })

    const revision = await response.json()

    return c.json(revision)
  },
)
