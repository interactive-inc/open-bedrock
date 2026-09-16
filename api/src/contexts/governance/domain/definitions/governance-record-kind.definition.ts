import { z } from "zod"

export const governanceRecordKinds = [
  "governance-acknowledgement-record",
  "governance-capability-record",
  "governance-document-reference-record",
  "governance-document-version-record",
  "governance-document-record",
  "governance-org-role-assignment-record",
  "governance-org-role-record",
  "governance-publication-approval-record",
] as const

export const governanceRecordKindSchema = z.enum(governanceRecordKinds)
export type GovernanceRecordKind = z.infer<typeof governanceRecordKindSchema>

/** 区切り文字や空文字を含む複合主キーを損失なく表す。 */
export function encodeGovernanceRecordId(parts: readonly string[]): string {
  return `key:${parts.map((part) => `${part.length}:${part}`).join("")}`
}

export function decodeGovernanceRecordId(recordId: string, expectedParts: number): string[] | null {
  if (!recordId.startsWith("key:") || expectedParts < 1) return null
  const parts: string[] = []
  let offset = 4
  for (let index = 0; index < expectedParts; index++) {
    const match = /^(0|[1-9]\d*):/u.exec(recordId.slice(offset))
    if (!match) return null
    const length = Number(match[1])
    if (!Number.isSafeInteger(length)) return null
    offset += match[0].length
    if (offset + length > recordId.length) return null
    parts.push(recordId.slice(offset, offset + length))
    offset += length
  }
  return offset === recordId.length && encodeGovernanceRecordId(parts) === recordId ? parts : null
}
