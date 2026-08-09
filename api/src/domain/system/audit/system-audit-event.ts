export type SystemAuditIdentifier = string | number

export type SystemAuditOutcome = "succeeded" | "denied" | "failed"

export type SystemAuditEventInput<
  ActorAccountId extends SystemAuditIdentifier = SystemAuditIdentifier,
> = Readonly<{
  actorAccountId: ActorAccountId | null
  action: string
  targetType: string
  targetId: string | null
  outcome: SystemAuditOutcome
  reasonCode: string | null
  authorizationJson: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  occurredAt: Date
}>

export type SystemAuditEvent<ActorAccountId extends SystemAuditIdentifier = SystemAuditIdentifier> =
  Readonly<{
    eventId: string
    actorAccountId: ActorAccountId | null
    action: string
    targetType: string
    targetId: string | null
    outcome: SystemAuditOutcome
    reasonCode: string | null
    authorizationJson: string | null
    beforeJson: string | null
    afterJson: string | null
    metadataJson: string | null
    occurredAtEpochMilliseconds: number
  }>
