import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee update <code> --name <n>

人物台帳の氏名だけを変更します。
メール・ロールはアカウント管理、所属・役職・在籍状態は personnel-action を使ってください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <code> が必要です")

    if (!query.name) throw new UsageError("--name が必要です")

    const client = await createClient()

    const response = await client.employees[":code"].$put({
      param: { code: employeeCode },
      json: { name: query.name },
    })

    return c.json(await response.json())
  },
)
