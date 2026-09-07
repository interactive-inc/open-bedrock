import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { uploadAttachment } from "@/lib/http/upload-attachment"
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { app } from "@/app/index"
import { SettingsFile } from "@/lib/config/settings-file"

const target = {
  proposal_version: 3,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 2,
}
let tokenSpy: ReturnType<typeof spyOn<SettingsFile, "tokensFor">>
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>
const requests: Request[] = []

beforeEach(() => {
  requests.length = 0
  tokenSpy = spyOn(SettingsFile.prototype, "tokensFor").mockResolvedValue({
    token: "test-access-token",
    refresh_token: null,
  })
  const fetcher = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      requests.push(
        input instanceof Request ? new Request(input, init) : new Request(String(input), init),
      )
      return Response.json({ status: "pending" })
    },
    { preconnect: fetch.preconnect },
  )
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(fetcher)
})
afterEach(() => {
  fetchSpy.mockRestore()
  tokenSpy.mockRestore()
})
function command(path: string, args: Record<string, string | string[]>) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  })
}

describe("経費CLIの確認対象と再送", () => {
  test.each(["approve", "reject", "cancel", "execute"])(
    "確認した対象を一回だけ送る: %s",
    async (operation) => {
      const response = await command(`/expenses/${operation}/42`, {
        "decision-target": JSON.stringify(target),
        comment: "確認済み",
      })
      expect(response.status).toBe(200)
      expect(requests).toHaveLength(1)
      const request = requests[0]!
      expect(new URL(request.url).pathname).toBe(`/expense/expenses/42/${operation}`)
      expect(request.method).toBe("POST")
      expect(request.headers.get("authorization")).toBe("Bearer test-access-token")
      expect(await request.json()).toEqual({
        decision_target: target,
        ...(["approve", "reject"].includes(operation) ? { comment: "確認済み" } : {}),
      })
    },
  )

  test("判断対象がない場合はAPIを呼ばない", async () => {
    const response = await command("/expenses/approve/42", {})
    expect(response.status).toBe(400)
    expect(requests).toHaveLength(0)
  })

  test("提出の再送キーと差戻し元をそのまま渡す", async () => {
    const key = "12345678-1234-4234-8234-123456789abc"
    const args = {
      "request-key": key,
      "previous-expense-id": "41",
      category: "supplies",
      "spent-at": "2026-09-08",
      "attachment-id": ["receipt-a", "receipt-b"],
      amount: "1000",
      note: "設備更新",
    }
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await command("/expenses/submit", args)).status).toBe(200)
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(new URL(request.url).pathname).toBe("/expense/expenses")
      expect(await request.json()).toEqual({
        request_key: key,
        previous_expense_id: 41,
        existing_expense_id: null,
        category: "supplies",
        spent_at: "2026-09-08",
        attachment_ids: ["receipt-a", "receipt-b"],
        amount: 1000,
        note: "設備更新",
      })
    }
  })
})

test("添付をSystemの実登録パスへ送って再利用するIDを受け取る", async () => {
  const directory = await mkdtemp(join(tmpdir(), "expense-upload-"))
  const path = join(directory, "receipt.pdf")
  try {
    await Bun.write(path, "%PDF-1.4 receipt")
    fetchSpy.mockImplementation(
      Object.assign(
        async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
          requests.push(
            input instanceof Request ? new Request(input, init) : new Request(String(input), init),
          )
          return Response.json({ id: "receipt-uploaded" }, { status: 201 })
        },
        { preconnect: fetch.preconnect },
      ),
    )
    expect(await uploadAttachment(path, "https://example.com")).toBe("receipt-uploaded")
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!.url).pathname).toBe("/system/attachments")
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer test-access-token")
    const file = (await requests[0]!.formData()).get("file")
    expect(file).toBeInstanceOf(File)
    if (!(file instanceof File)) throw new Error("file missing")
    expect(await file.text()).toBe("%PDF-1.4 receipt")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
