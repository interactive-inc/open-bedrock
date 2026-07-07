import { app } from "@/app/index"
import { describe, expect, it } from "bun:test"

// 人事の記録系3ドメイン（資格・健診・労災）の CLI コマンドが index.ts に登録され、
// help が返る（catch-all に落ちない）ことを確認する。動的セグメント (:id?) は省略形でも一致する。
const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/certifications", help: "karte certifications" },
  { path: "/certifications/create", help: "certifications create" },
  { path: "/certifications/update", help: "certifications update" },
  { path: "/certifications/records", help: "certifications records" },
  { path: "/certifications/record-add", help: "certifications record-add" },
  { path: "/certifications/record-remove", help: "certifications record-remove" },
  { path: "/health-checkups", help: "karte health-checkups" },
  { path: "/health-checkups/create", help: "health-checkups create" },
  { path: "/health-checkups/complete", help: "health-checkups complete" },
  { path: "/work-accidents", help: "karte work-accidents" },
  { path: "/work-accidents/create", help: "work-accidents create" },
  { path: "/work-accidents/close", help: "work-accidents close" },
]

describe("hr records domains commands", () => {
  for (const route of paths) {
    it(`POST ${route.path} is reachable and returns its help`, async () => {
      const response = await app.request(route.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ help: "1" }),
      })

      expect(response.status).toBe(200)

      expect(await response.text()).toContain(route.help)
    })
  }

  it("certifications create requires --code and --name", async () => {
    const response = await app.request("/certifications/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "応用情報" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("work-accidents create requires --occurred and --summary", async () => {
    const response = await app.request("/work-accidents/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: "転倒" }),
    })

    expect(response.status).not.toBe(200)
  })
})
