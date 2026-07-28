import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock review-forms bulk --cycle-id <id> --forms <file>
  被評価者と評価者種別の組を一括作成（360度評価・管理者）。
  --forms は [{ "subject_employee_id": n, "reviewer_employee_id": n, "reviewer_type": "self|manager|peer|subordinate" }] 形式の JSON ファイル。`

const formSchema = z.object({
  subject_employee_id: z.number().int().positive(),
  reviewer_employee_id: z.number().int().positive(),
  reviewer_type: z.enum(["self", "manager", "peer", "subordinate"]),
})

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "cycle-id": z.string().optional(),
      forms: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query["cycle-id"]) throw new UsageError("--cycle-id が必要です")

    if (!query.forms) throw new UsageError("--forms（JSON ファイル）が必要です")

    const parsed = z.array(formSchema).safeParse(await readJsonFile(query.forms))

    if (parsed.success === false) {
      throw new UsageError("--forms の JSON が不正です（配列と各要素の形式を確認してください）")
    }

    const client = await createClient()

    const response = await client["review-cycles"][":cycle_id"].forms.bulk.$post({
      param: { cycle_id: query["cycle-id"] },
      json: { forms: parsed.data },
    })

    return c.json(await response.json())
  },
)
