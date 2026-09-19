import { removeContextFromAggregate } from "./verify-business-context-removal"
import { describe, expect, test } from "bun:test"

describe("束ねるだけのファイルからの業務contextの除去", () => {
  test("対象のimportと、そのidentifierだけを置いた行を除く", () => {
    const source = [
      'import { ROOM_PERMISSION_KEYS } from "@/contexts/room/domain/catalogs/iam/room-permission-key.catalog"',
      'import { SHIFT_PERMISSION_KEYS } from "@/contexts/shift/domain/catalogs/iam/shift-permission-key.catalog"',
      "export const KEYS = [",
      "  ...ROOM_PERMISSION_KEYS,",
      "  ...SHIFT_PERMISSION_KEYS,",
      "] as const",
      "export const BY_CONTEXT = {",
      "  room: ROOM_PERMISSION_KEYS,",
      "  shift: SHIFT_PERMISSION_KEYS,",
      "}",
    ].join("\n")

    const removal = removeContextFromAggregate(source, "room")

    expect(removal.identifiers).toEqual(["ROOM_PERMISSION_KEYS"])
    expect(removal.source).not.toContain("ROOM_PERMISSION_KEYS")
    expect(removal.source).toContain("  ...SHIFT_PERMISSION_KEYS,")
    expect(removal.source).toContain("  shift: SHIFT_PERMISSION_KEYS,")
  })

  test("namespace importとハイフンを含むcontext名を扱う", () => {
    const source = [
      'import * as ownedSchema7 from "@/contexts/business-trip/infrastructure/schema/business-trip"',
      "export const schema = {",
      "  ...ownedSchema7,",
      "}",
      "export const BY_CONTEXT = {",
      '  "business-trip": ownedSchema7,',
      "}",
    ].join("\n")

    const removal = removeContextFromAggregate(source, "business-trip")

    expect(removal.identifiers).toEqual(["ownedSchema7"])
    expect(removal.source).not.toContain("ownedSchema7")
  })

  test("名前が前方一致する別のcontextのimportを除かない", () => {
    const source =
      'import { LEAVE_KEYS } from "@/contexts/leave/keys"\nimport { FAMILY_KEYS } from "@/contexts/family-care-leave/keys"\n'

    const removal = removeContextFromAggregate(source, "leave")

    expect(removal.identifiers).toEqual(["LEAVE_KEYS"])
    expect(removal.source).toContain("FAMILY_KEYS")
  })

  test("identifierが式の中に残る場合は行を除かず、呼び出し側が検出できる", () => {
    const source =
      'import { ROOM_KEYS } from "@/contexts/room/keys"\nexport const COUNT = ROOM_KEYS.length\n'

    const removal = removeContextFromAggregate(source, "room")

    expect(removal.source).toContain("ROOM_KEYS.length")
  })
})
