export type GovernanceImpactIssue = {
  severity: "error" | "warning"
  code: string
  document_code: string | null
  message: string
  reference: string | null
}

export type GovernanceImpactReport = {
  checked_at: string
  organization_source: "lifecycle"
  document_count: number
  summary: { errors: number; warnings: number }
  issues: ReadonlyArray<GovernanceImpactIssue>
}

export function governanceImpactIssue(
  severity: GovernanceImpactIssue["severity"],
  code: string,
  documentCode: string | null,
  message: string,
  reference: string | null,
): GovernanceImpactIssue {
  return { severity, code, document_code: documentCode, message, reference }
}

export function findAuthorityRuleOverlaps(
  rules: ReadonlyArray<{
    key: string
    capability: string
    action: string
    amount_min: number | null
    amount_max: number | null
  }>,
): ReadonlyArray<string> {
  const messages: Array<string> = []
  for (const [index, left] of rules.entries()) {
    for (const right of rules.slice(index + 1)) {
      if (left.capability !== right.capability || left.action !== right.action) continue
      const leftMin = left.amount_min ?? Number.NEGATIVE_INFINITY
      const leftMax = left.amount_max ?? Number.POSITIVE_INFINITY
      const rightMin = right.amount_min ?? Number.NEGATIVE_INFINITY
      const rightMax = right.amount_max ?? Number.POSITIVE_INFINITY
      if (leftMin <= rightMax && rightMin <= leftMax) {
        messages.push(`権限ルール ${left.key} と ${right.key} の条件範囲が重複しています`)
      }
    }
  }
  return messages
}
