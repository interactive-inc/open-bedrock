import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { readSecretStdin } from "@/lib/input/read-secret-stdin"

export const help = `bedrock employees register --code <c> --name <n> --hire-on <YYYY-MM-DD> --email <e> --role <r> --password-stdin [--department-code <c>] [--position-code <c>] [--manager-employee-code <c>]

役職は役職マスタの code を指定してください（自由入力ではありません）。
初期パスワードはコマンド引数に含めず、標準入力から渡してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      "password-stdin": z.string().optional(),
      role: z.enum(["member", "manager", "hr", "root"]).optional(),
      "hire-on": z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      "department-code": z.string().optional(),
      "position-code": z.string().optional(),
      "manager-employee-code": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (
      !query.code ||
      !query.name ||
      !query.email ||
      !query.role ||
      !query["hire-on"] ||
      !query["password-stdin"]
    )
      throw new UsageError(
        "--code, --name, --hire-on, --email, --role, --password-stdin が必要です",
      )

    const password = await readSecretStdin()

    const payload = {
      code: query.code,
      name: query.name,
      email: query.email,
      password,
      role: query.role,
      hire_on: query["hire-on"],
      department_code: query["department-code"] ?? null,
      position_code: query["position-code"] ?? null,
      manager_employee_code: query["manager-employee-code"] ?? null,
    }

    const client = await createClient()

    const response = await client.company["employee-registrations"].$post({ json: payload })

    return c.json(await response.json())
  },
)
