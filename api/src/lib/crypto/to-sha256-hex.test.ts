import { expect, test } from "bun:test"
import { toSha256Hex } from "@/lib/crypto/to-sha256-hex"

test("toSha256Hex is deterministic", async () => {
  expect(await toSha256Hex("open-karte")).toHaveLength(64)
  expect(await toSha256Hex("open-karte")).toBe(await toSha256Hex("open-karte"))
})
