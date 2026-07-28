import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock employee delete <code> — 物理削除は廃止されました。退職発令後に employee archive を使用してください。`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client.employees[":code"].$delete({
      param: { code: employeeCode },
    })

    if (response.status !== 204) {
      throw new UsageError("従業員の削除に失敗しました")
    }

    return c.json({ code: employeeCode, status: "deleted" })
  },
)
