import { expect, test } from "bun:test"
import { isSoftwareLicenseRecordSourceFrozenError } from "@/contexts/software-license/infrastructure/repositories/lib/is-software-license-record-source-frozen-error"

test("D1が包んだ台帳停止だけを識別する", () => {
  expect(
    isSoftwareLicenseRecordSourceFrozenError(
      new Error("Failed query", {
        cause: new Error("D1_ERROR: software_license_record_source_frozen: SQLITE_CONSTRAINT"),
      }),
    ),
  ).toBe(true)
  expect(isSoftwareLicenseRecordSourceFrozenError(new Error("software_license_record_source_frozen"))).toBe(
    true,
  )
  expect(
    isSoftwareLicenseRecordSourceFrozenError(
      new Error("Failed query: INSERT INTO software_licenses VALUES ('software_license_record_source_frozen')"),
    ),
  ).toBe(false)
})
