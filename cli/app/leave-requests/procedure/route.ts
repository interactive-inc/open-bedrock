import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { api } from "@/lib/http/client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `bedrock leave-requests procedure --id <id>
  --operation submit --request-key <uuid> --content-digest <確認したdigest> [--previous-leave-request-id <差戻し元>]
  --operation approve|reject|complete|cancel --decision-target '<確認したJSON>' [--comment <理由>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      id: z.string().optional(),
      operation: z.enum(["submit", "approve", "reject", "complete", "cancel"]).optional(),
      "previous-leave-request-id": z.string().optional(),
      "request-key": z.string().optional(),
      "content-digest": z.string().optional(),
      "decision-target": z.string().optional(),
      comment: z.string().max(3000).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    if (
      query.id === undefined ||
      !/^[1-9]\d*$/.test(query.id) ||
      !Number.isSafeInteger(Number(query.id))
    )
      throw new UsageError("--id に休暇番号を指定してください")
    const path = `/leave/leave-requests/${query.id}`
    if (query.operation === undefined)
      return c.text(JSON.stringify(await api(path + "/procedure"), null, 2))
    if (query.operation === "submit") {
      const previous = z.coerce
        .number()
        .int()
        .positive()
        .safe()
        .nullable()
        .safeParse(query["previous-leave-request-id"] ?? null)
      if (!previous.success) throw new UsageError("差戻し元の番号が不正です")
      const submission = z
        .object({
          request_key: z.string().uuid(),
          confirmed_content_digest: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .safeParse({
          request_key: query["request-key"],
          confirmed_content_digest: query["content-digest"],
        })
      if (!submission.success)
        throw new UsageError("--request-key と確認済みの --content-digest を指定してください")
      return c.text(
        JSON.stringify(
          await api(path + "/submit", {
            method: "POST",
            json: { ...submission.data, previous_leave_request_id: previous.data },
          }),
          null,
          2,
        ),
      )
    }
    const raw = query["decision-target"]
    if (raw === undefined)
      throw new UsageError("--decision-target に確認したJSONを指定してください")
    let target: unknown
    try {
      target = JSON.parse(raw)
    } catch {
      throw new UsageError("判断対象のJSONが不正です")
    }
    const parsed = z
      .object({
        proposal_version: z.number().int().positive(),
        proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
        task_key: z.string().min(1).max(100),
        task_round: z.number().int().positive(),
      })
      .strict()
      .safeParse(target)
    if (!parsed.success) throw new UsageError("判断対象が不正です")
    if (query.operation === "cancel")
      return c.text(
        JSON.stringify(
          await api(path + "/procedure/cancel", {
            method: "POST",
            json: { decision_target: parsed.data },
          }),
          null,
          2,
        ),
      )
    if (query.operation === "complete")
      return c.text(
        JSON.stringify(
          await api(path + "/procedure/complete", {
            method: "POST",
            json: { decision_target: parsed.data },
          }),
          null,
          2,
        ),
      )
    return c.text(
      JSON.stringify(
        await api(path + "/procedure/decisions", {
          method: "POST",
          json: {
            decision_target: parsed.data,
            action: query.operation,
            comment: query.comment ?? null,
          },
        }),
        null,
        2,
      ),
    )
  },
)
