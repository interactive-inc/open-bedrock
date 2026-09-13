import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import { z } from "zod"

const payloadSchema = z
  .object({
    version: z.literal(1),
    source: z.unknown(),
    contentBase64: z
      .string()
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })
  .strict()

/** 保存形式・取得情報・本文digestを確認し、元のバイト列を復元する。 */
export class PreservedRecordPayloadValue {
  private constructor(
    readonly source: PreservedRecordSourceValue,
    readonly content: PreservedRecordContentValue,
  ) {
    Object.freeze(this)
  }

  static async restore(
    bytes: Uint8Array,
    expected: PreservedRecordSourceValue,
  ): Promise<PreservedRecordPayloadValue | Error> {
    if (bytes.byteLength > ATTACHMENT_MAX_BYTE_SIZE) return new Error("record payload too large")
    try {
      const parsed = payloadSchema.safeParse(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      )
      if (!parsed.success) return parsed.error
      const source = PreservedRecordSourceValue.create(parsed.data.source)
      if (source instanceof Error) return source
      if (
        !source.matchesSource(expected) ||
        source.props.capturedAt !== expected.props.capturedAt
      ) {
        return new Error("preserved record source differs from expected snapshot")
      }
      const binary = atob(parsed.data.contentBase64)
      if (btoa(binary) !== parsed.data.contentBase64)
        return new Error("noncanonical record encoding")
      const content = await PreservedRecordContentValue.create(
        source,
        Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      )
      if (content instanceof Error) return content
      return new PreservedRecordPayloadValue(source, content)
    } catch (cause) {
      return new Error("preserved record payload cannot be restored", { cause })
    }
  }
}
