import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { expect, test } from "bun:test"

const sourceInput = {
  sourceNamespace: "source-tenant-1",
  ownerContext: "sample-records",
  recordKind: "record",
  recordId: "original-1",
  formatId: "sample-record",
  formatVersion: 1,
  sourceRevision: null,
  sourceRecordedAt: null,
  capturedAt: "2026-09-13T00:00:00.000Z",
  contentDigest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
}
const source = PreservedRecordSourceValue.create(sourceInput)
if (source instanceof Error) throw source
const payload = { version: 1, source: sourceInput, contentBase64: "YWJj" }

test("原記録のバイト列を復元し、元にない来歴はnullのまま保持する", async () => {
  const restored = await PreservedRecordPayloadValue.restore(
    new TextEncoder().encode(JSON.stringify(payload)),
    source,
  )
  if (restored instanceof Error) throw restored
  expect([...restored.content.toBytes()]).toEqual([97, 98, 99])
  expect(restored.source.props.sourceRevision).toBeNull()
  expect(restored.source.props.sourceRecordedAt).toBeNull()
})

test("未知の保存形式・異なる出所・取得日時・不正な本文を復元成功と扱わない", async () => {
  for (const invalid of [
    { ...payload, version: 2 },
    { ...payload, source: { ...sourceInput, sourceNamespace: "source-tenant-2" } },
    { ...payload, source: { ...sourceInput, formatVersion: 2 } },
    { ...payload, source: { ...sourceInput, capturedAt: "2026-09-14T00:00:00.000Z" } },
    { ...payload, contentBase64: "YWJk" },
    { ...payload, contentBase64: "YWJj\n" },
    { ...payload, contentBase64: "YWJj=" },
    { ...payload, injectedField: true },
  ]) {
    expect(
      await PreservedRecordPayloadValue.restore(
        new TextEncoder().encode(JSON.stringify(invalid)),
        source,
      ),
    ).toBeInstanceOf(Error)
  }
  expect(await PreservedRecordPayloadValue.restore(new Uint8Array([0xff]), source)).toBeInstanceOf(
    Error,
  )
})
