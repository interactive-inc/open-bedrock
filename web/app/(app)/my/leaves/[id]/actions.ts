"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

type State = { ok: boolean; error: string | null }
const targetSchema = z
  .object({
    proposal_version: z.number().int().positive(),
    proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
    task_key: z.string().min(1),
    task_round: z.number().int().positive(),
  })
  .strict()

/** 表示時に確認した内容と判断対象をそのまま送る。 */
export async function actOnLeaveProcedure(_previous: State, form: FormData): Promise<State> {
  const id = z.coerce.number().int().positive().safe().safeParse(form.get("id"))
  const operation = z
    .enum(["submit", "approve", "reject", "complete", "cancel"])
    .safeParse(form.get("operation"))
  if (!id.success || !operation.success) return { ok: false, error: "操作対象が不正です" }
  const client = await createClient()
  const endpoint = client.leave["leave-requests"][":id"]
  const param = { id: String(id.data) }
  const send = async () => {
    if (operation.data === "submit") {
      const previousValue = form.get("previous_leave_request_id")
      const previous = z.coerce
        .number()
        .int()
        .positive()
        .safe()
        .nullable()
        .safeParse(previousValue === "" || previousValue === null ? null : previousValue)
      if (!previous.success) return new Error("差戻し元の休暇番号が不正です")
      const input = z
        .object({
          request_key: z.string().uuid(),
          confirmed_content_digest: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .safeParse({
          request_key: form.get("request_key"),
          confirmed_content_digest: form.get("confirmed_content_digest"),
        })
      if (!input.success) return new Error("確認した申請内容が不正です")
      return endpoint.submit.$post({
        param,
        json: { ...input.data, previous_leave_request_id: previous.data },
      })
    }
    const raw = form.get("decision_target")
    if (typeof raw !== "string") return new Error("確認した判断対象がありません")
    const target = targetSchema.safeParse(JSON.parse(raw))
    if (!target.success) return new Error("確認した判断対象が不正です")
    if (operation.data === "cancel")
      return endpoint.procedure.cancel.$post({ param, json: { decision_target: target.data } })
    if (operation.data === "complete")
      return endpoint.procedure.complete.$post({ param, json: { decision_target: target.data } })
    const comment = form.get("comment")
    if (typeof comment !== "string" || comment.length > 3000)
      return new Error("コメントは3000文字以内で入力してください")
    return endpoint.procedure.decisions.$post({
      param,
      json: { decision_target: target.data, action: operation.data, comment: comment || null },
    })
  }
  try {
    const response = await send()
    if (response instanceof Error) return { ok: false, error: response.message }
    if (response.status >= 400) {
      const error = await toResponseError(response, {
        fallback: "休暇の処理に失敗しました。内容と判断状況を確認してください",
      })
      return { ok: false, error: error.message }
    }
    revalidatePath(`/my/leaves/${id.data}`)
    revalidatePath("/my/leaves")
    revalidatePath("/inbox/leaves")
    return { ok: true, error: null }
  } catch {
    return { ok: false, error: "操作を完了できませんでした。表示内容を確認して再試行してください" }
  }
}
