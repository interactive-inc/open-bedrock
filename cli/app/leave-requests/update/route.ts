import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

const LEAVE_TYPES = [
  "annual",
  "special",
  "compensatory",
  "summer",
  "child_nursing_care",
  "prenatal_checkup",
  "menstrual",
  "caregiving_leave",
] as const

const LEAVE_UNITS = ["full_day", "half_day_am", "half_day_pm", "hourly"] as const

export const help = `bedrock leave-requests update --id <leave-request-id> --type ${LEAVE_TYPES.join("|")} --start <date> --end <date> [--unit ${LEAVE_UNITS.join("|")}] [--hours <number>] [--reason <text>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      type: z.enum(LEAVE_TYPES).optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      unit: z.enum(LEAVE_UNITS).optional(),
      hours: z.number().positive().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id || !query.type || !query.start || !query.end)
      throw new UsageError("--id, --type, --start, --end が必要です")

    const client = await createClient()

    const response = await client["leave"]["leave-requests"][":id"].$put({
      param: { id: query.id },
      json: {
        leave_type: query.type,
        start_date: query.start,
        end_date: query.end,
        unit: query.unit ?? "full_day",
        hours: query.hours ?? null,
        reason: query.reason ?? null,
      },
    })

    const leaveRequest = await response.json()

    return c.json(leaveRequest)
  },
)
