import { describe, expect, test } from "bun:test"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"

describe("toCanonicalSystemJson", () => {
  test("object key順と入れ子を安定化し、入力を変更しない", () => {
    const input = { z: [3, { b: true, a: null }], a: "value" }
    const snapshot = structuredClone(input)

    expect(toCanonicalSystemJson(input)).toBe('{"a":"value","z":[3,{"a":null,"b":true}]}')
    expect(input).toEqual(snapshot)
  })

  test.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, 1n, new Date()])(
    "JSONではない値を拒否する",
    (input) => {
      expect(toCanonicalSystemJson(input)).toBeInstanceOf(InvalidSystemProposalError)
    },
  )

  test("循環参照、疎配列、accessorを拒否する", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const sparse: unknown[] = []
    sparse.length = 1
    const accessor: Record<string, unknown> = {}
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => "hidden",
    })

    expect(toCanonicalSystemJson(cyclic)).toBeInstanceOf(InvalidSystemProposalError)
    expect(toCanonicalSystemJson(sparse)).toBeInstanceOf(InvalidSystemProposalError)
    expect(toCanonicalSystemJson(accessor)).toBeInstanceOf(InvalidSystemProposalError)
  })

  test("1MBを超えるpayloadを拒否する", () => {
    const result = toCanonicalSystemJson({ value: "x".repeat(1_000_000) })

    expect(result).toBeInstanceOf(InvalidSystemProposalError)
    if (result instanceof InvalidSystemProposalError) expect(result.code).toBe("payload_too_large")
  })
})
