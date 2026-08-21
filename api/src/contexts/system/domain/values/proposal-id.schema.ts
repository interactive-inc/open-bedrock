import { z } from "zod"

export const proposalIdSchema = z.string().min(1).max(255).brand<"ProposalId">()
export const proposalSeriesIdSchema = z.string().min(1).max(255).brand<"ProposalSeriesId">()
export type ProposalId = z.infer<typeof proposalIdSchema>
export type ProposalSeriesId = z.infer<typeof proposalSeriesIdSchema>

/** 新しいSystem提案を識別するopaque IDを生成する。 */
export function createProposalId(): ProposalId {
  return proposalIdSchema.parse(crypto.randomUUID())
}
