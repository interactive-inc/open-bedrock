import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock training-enrollments create --course <code> [--employee-code <c>] [--due <date>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      course: z.string().optional(),
      "employee-code": z.string().optional(),
      due: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.course) throw new UsageError("--course <code> が必要です")

    const client = await createClient()

    const response = await client["training-enrollments"].$post({
      json: {
        course_code: query.course,
        employee_code: query["employee-code"],
        due_date: query.due,
      },
    })

    const enrollment = await response.json()

    return c.json(enrollment)
  },
)
