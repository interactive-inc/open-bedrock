import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/workflow/system-case-reference"

/** canonical proposal JSONのSHA-256をSystem workflow digestへ変換する。 */
export async function toSystemProposalDigest(
  canonicalJson: string,
): Promise<ProposalDigest | InvalidSystemProposalError> {
  const bytes = new TextEncoder().encode(canonicalJson)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  const hexadecimal = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const parsed = proposalDigestSchema.safeParse(hexadecimal)

  return parsed.success ? parsed.data : new InvalidSystemProposalError("invalid_shape")
}
