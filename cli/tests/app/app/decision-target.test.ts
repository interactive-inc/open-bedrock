import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const target = {
  proposal_version: 7,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 3,
}
const originalConfigDir = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "decision-target-cli-"))
beforeAll(() => {
  process.env.BEDROCK_CONFIG_DIR = directory
})
afterAll(() => {
  if (originalConfigDir === undefined) delete process.env.BEDROCK_CONFIG_DIR
  else process.env.BEDROCK_CONFIG_DIR = originalConfigDir
  rmSync(directory, { recursive: true, force: true })
})

describe("CLIの確認済み判断対象", () => {
  test.each(["approve", "reject"])(
    "確認した参照だけをPOSTし、最新版を取得しない: %s",
    async (action) => {
      const requests: Request[] = []
      const fetcher = Object.assign(
        async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
          requests.push(
            input instanceof Request ? new Request(input, init) : new Request(String(input), init),
          )
          return Response.json({ status: "approved" })
        },
        { preconnect: fetch.preconnect },
      )
      const interception = spyOn(globalThis, "fetch").mockImplementation(fetcher)
      try {
        const response = await app.request(`/application-requests/${action}/42`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            "decision-target": JSON.stringify(target),
            comment: "Reviewed content",
          }),
        })
        expect(response.status).toBe(200)
        expect(requests).toHaveLength(1)
        expect(requests[0]?.method).toBe("POST")
        expect(requests[0]?.url).toEndWith(`/company/application-requests/42/${action}`)
        expect(await requests[0]?.json()).toEqual({
          decision_target: target,
          comment: "Reviewed content",
        })
      } finally {
        interception.mockRestore()
      }
    },
  )

  test.each(["approve", "reject"])(
    "参照の欠落・不正をAPI呼出し前に拒否する: %s",
    async (action) => {
      const interception = spyOn(globalThis, "fetch")
      try {
        for (const invalid of [
          undefined,
          "invalid JSON",
          JSON.stringify({ ...target, proposal_version: 0 }),
        ]) {
          const response = await app.request(`/application-requests/${action}/42`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ "decision-target": invalid, comment: "Decision" }),
          })
          expect(response.status).toBe(400)
        }
        expect(interception).not.toHaveBeenCalled()
      } finally {
        interception.mockRestore()
      }
    },
  )
})
