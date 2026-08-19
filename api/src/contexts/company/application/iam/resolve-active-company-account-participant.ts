import { resolveCompanyAccountParticipants } from "@/contexts/company/application/iam/resolve-company-account-participants"
import type { CompanyAccountParticipant } from "@/contexts/company/application/iam/resolve-company-account-participants"
import type { Context } from "@/env"
import type { AccountId } from "@system/domain/auth/account-id"

export async function resolveActiveCompanyAccountParticipant(
  c: Context,
  accountId: AccountId,
): Promise<CompanyAccountParticipant | null | Error> {
  const participants = await resolveCompanyAccountParticipants(c, [accountId])
  if (participants instanceof Error) return participants
  const participant = participants.at(0) ?? null
  return participant !== null && participant.status === "active" && participant.archivedAt === null
    ? participant
    : null
}
