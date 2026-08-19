import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"

const jwtSecret = "feature-gate-test-secret"

/**
 * ゲートは認証より前段で判定するため、トークン無しで叩き
 * 404（機能無効で遮断）と 401（ゲートを通過し認証で止まる）を対比して検証する。
 */
async function statusFor(
  path: string,
  features: { enabledOptionalFeatures?: string; disabledStandardFeatures?: string },
): Promise<number> {
  const response = await requestWithContext({
    db: createD1TestDatabase(loadSchema()),
    jwtSecret,
    path,
    token: null,
    enabledOptionalFeatures: features.enabledOptionalFeatures,
    disabledStandardFeatures: features.disabledStandardFeatures,
  })

  return response.status
}

describe("feature gate: company-optional", () => {
  test("optional features are disabled when the variable is empty (docs default)", async () => {
    expect(await statusFor("/thanks-rewards", { enabledOptionalFeatures: "" })).toBe(404)
    expect(await statusFor("/one-on-ones", { enabledOptionalFeatures: "" })).toBe(404)
    expect(await statusFor("/performance-goals", { enabledOptionalFeatures: "none" })).toBe(404)
  })

  test("sub paths of a disabled feature are also blocked", async () => {
    expect(await statusFor("/review-cycles/1/policy", { enabledOptionalFeatures: "" })).toBe(404)
    expect(await statusFor("/thanks-redemptions/inbox", { enabledOptionalFeatures: "" })).toBe(404)
  })

  test("'all' enables every optional feature (request reaches authentication)", async () => {
    expect(await statusFor("/thanks-rewards", { enabledOptionalFeatures: "all" })).toBe(401)
    expect(await statusFor("/review-forms", { enabledOptionalFeatures: "all" })).toBe(401)
  })

  test("a comma separated list enables only the named features", async () => {
    expect(await statusFor("/thanks-rewards", { enabledOptionalFeatures: "thanks" })).toBe(401)
    expect(await statusFor("/performance-goals", { enabledOptionalFeatures: "thanks" })).toBe(404)
    expect(await statusFor("/one-on-ones", { enabledOptionalFeatures: "thanks,one-on-ones" })).toBe(
      401,
    )
  })

  test("core routes stay reachable even when every optional feature is disabled", async () => {
    expect(await statusFor("/employees", { enabledOptionalFeatures: "" })).toBe(401)
    expect(await statusFor("/departments", { enabledOptionalFeatures: "" })).toBe(401)
  })

  test("management dashboard is gated without touching the home dashboard", async () => {
    expect(await statusFor("/dashboard/management", { enabledOptionalFeatures: "" })).toBe(404)
    expect(await statusFor("/dashboard", { enabledOptionalFeatures: "" })).toBe(401)
  })
})

describe("feature gate: company-standard", () => {
  test("standard features stay enabled by default", async () => {
    expect(await statusFor("/expenses/me", {})).toBe(401)
    expect(await statusFor("/rooms", {})).toBe(401)
  })

  test("a comma separated list disables only the named features", async () => {
    expect(await statusFor("/rooms", { disabledStandardFeatures: "rooms" })).toBe(404)
    expect(await statusFor("/rental-reservations/me", { disabledStandardFeatures: "rooms" })).toBe(
      401,
    )
    expect(await statusFor("/expenses/me", { disabledStandardFeatures: "rooms" })).toBe(401)
  })

  test("'all' disables every standard feature while core stays reachable", async () => {
    expect(await statusFor("/expenses/me", { disabledStandardFeatures: "all" })).toBe(404)
    expect(await statusFor("/attendance-records", { disabledStandardFeatures: "all" })).toBe(404)
    expect(await statusFor("/employees", { disabledStandardFeatures: "all" })).toBe(401)
  })

  test("unknown feature keys are ignored", async () => {
    expect(await statusFor("/expenses/me", { disabledStandardFeatures: "no-such-feature" })).toBe(
      401,
    )
  })
})
