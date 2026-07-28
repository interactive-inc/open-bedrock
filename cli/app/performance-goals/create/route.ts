import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { toFiniteNumber } from "@/lib/to-finite-number"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock performance-goals create --period <p> --title <t> [--kpi <k>] [--weight <n>] [--owner-type individual|department|company] [--department-code <c>] [--parent-goal-id <id>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      period: z.string().optional(),
      title: z.string().optional(),
      kpi: z.string().optional(),
      weight: z.string().optional(),
      "owner-type": z.enum(["individual", "department", "company"]).optional(),
      "department-code": z.string().optional(),
      "parent-goal-id": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.period || !query.title) throw new UsageError("--period と --title が必要です")

    const client = await createClient()

    const response = await client["performance-goals"].$post({
      json: {
        period: query.period,
        title: query.title,
        weight: query.weight ? toFiniteNumber(query.weight, "--weight") : 10,
        kpi: query.kpi,
        owner_type: query["owner-type"] ?? "individual",
        department_code: query["department-code"],
        parent_goal_id: query["parent-goal-id"]
          ? toFiniteNumber(query["parent-goal-id"], "--parent-goal-id")
          : undefined,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
