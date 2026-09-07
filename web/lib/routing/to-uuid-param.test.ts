import { describe, expect, test } from "vite-plus/test"
import { toUuidParam } from "@/lib/routing/to-uuid-param"

describe("toUuidParam", () => {
  test("UUID v4 と v7 をそのまま返す", () => {
    expect(toUuidParam("4e70a050-497b-482e-9766-6937dca05295")).toBe(
      "4e70a050-497b-482e-9766-6937dca05295",
    )
    expect(toUuidParam("01900000-0000-7000-8000-000000000a01")).toBe(
      "01900000-0000-7000-8000-000000000a01",
    )
  })

  test("連番や業務コードは受け取らない", () => {
    expect(toUuidParam("1")).toBeNull()
    expect(toUuidParam("E001")).toBeNull()
    expect(toUuidParam("organization:default")).toBeNull()
  })

  test("version と variant が範囲外の値は受け取らない", () => {
    expect(toUuidParam("11111111-1111-1111-1111-111111111111")).toBeNull()
    expect(toUuidParam("abcdefab-cdef-0abc-8def-abcdefabcdef")).toBeNull()
    expect(toUuidParam("abcdefab-cdef-4abc-cdef-abcdefabcdef")).toBeNull()
  })

  test("大文字と桁違いは受け取らない", () => {
    expect(toUuidParam("4E70A050-497B-482E-9766-6937DCA05295")).toBeNull()
    expect(toUuidParam("4e70a050-497b-482e-9766-6937dca0529")).toBeNull()
    expect(toUuidParam("")).toBeNull()
  })
})
