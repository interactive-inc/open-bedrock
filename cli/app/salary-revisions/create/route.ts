import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { toFiniteNumber } from "@/lib/to-finite-number"

export const help = `bedrock salary-revisions create --employee-id <id> --effective-date <d> --previous-base-salary <n> --new-base-salary <n> [--reason <t>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      "effective-date": z.string().optional(),
      "previous-base-salary": z.string().optional(),
      "new-base-salary": z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (
      !query["employee-id"] ||
      !query["effective-date"] ||
      !query["previous-base-salary"] ||
      !query["new-base-salary"]
    )
      throw new UsageError(
        "--employee-id と --effective-date と --previous-base-salary と --new-base-salary が必要です",
      )

    const employeeId = toFiniteNumber(query["employee-id"], "--employee-id")

    const previousBaseSalary = toFiniteNumber(
      query["previous-base-salary"],
      "--previous-base-salary",
    )

    const newBaseSalary = toFiniteNumber(query["new-base-salary"], "--new-base-salary")

    const client = await createClient()

    const response = await client["salary-revisions"].$post({
      json: {
        employee_id: employeeId,
        effective_date: query["effective-date"],
        previous_base_salary: previousBaseSalary,
        new_base_salary: newBaseSalary,
        reason: query.reason,
      },
    })

    return c.json(await response.json())
  },
)
