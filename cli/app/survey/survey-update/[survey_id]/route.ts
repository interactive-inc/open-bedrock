import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { readJsonFile } from "@/lib/io/read-json"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `karte survey survey-update <id> --title <t> --status open|closed [--questions <file>] — アンケートを変更（管理権限）`

const surveyQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  text: z.string(),
})

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      title: z.string().optional(),
      status: z.string().optional(),
      questions: z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ survey_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const surveyId = c.req.valid("param").survey_id

    if (!surveyId) throw new UsageError("引数 <id> が必要です")

    if (!query.title) throw new UsageError("--title が必要です")

    const status = query.status ?? "open"

    if (status !== "open" && status !== "closed") {
      throw new UsageError("--status は open か closed を指定してください")
    }

    const questionsJson = await toQuestionsJson(query.questions)

    const client = await createClient()

    const response = await client.surveys[":survey_id"].$put({
      param: { survey_id: surveyId },
      json: { title: query.title, status: status, questions_json: [...questionsJson] },
    })

    if (response.status !== 200) {
      throw new UsageError("アンケートの変更に失敗しました")
    }

    return c.json(await response.json())
  },
)

// --questions <file> を設問配列として読む。未指定なら空配列。
async function toQuestionsJson(
  filePath: string | undefined,
): Promise<ReadonlyArray<z.infer<typeof surveyQuestionSchema>>> {
  if (filePath === undefined) {
    return []
  }

  const parsed = z.array(surveyQuestionSchema).safeParse(await readJsonFile(filePath))

  if (parsed.success === false) {
    throw new UsageError("--questions の JSON は配列形式である必要があります")
  }

  return parsed.data
}
