import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock knowledge-articles withdraw --id <id> --revision <n> --reason <text> --idempotency-key <uuid>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      reason: z.string().trim().min(1).max(2000).optional(),
      "idempotency-key": z.string().uuid().optional(),
      revision: z
        .string()
        .regex(/^[1-9]\d*$/)
        .transform(Number)
        .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
        .optional(),

      id: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    if (!query.reason || !query["idempotency-key"] || query.revision === undefined)
      return c.json({ error: "--reason, --idempotency-key, --revision が必要です" }, 400)

    const client = await createClient()

    const response = await client["knowledge"]["knowledge-articles"][":id"].$delete({
      param: { id: query.id },
      header: { "idempotency-key": query["idempotency-key"], "if-match": `"${query.revision}"` },
      json: { reason: query.reason },
    })

    if (response.status !== 204) {
      throw new UsageError("記事の取下げに失敗しました")
    }

    return c.json({ id: query.id, status: "withdrawn" })
  },
)
