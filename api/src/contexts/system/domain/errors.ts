export type SystemAuditJsonErrorCode = "invalid_json" | "payload_too_large"

function toSystemAuditJsonErrorMessage(code: SystemAuditJsonErrorCode): string {
  return code === "payload_too_large"
    ? "system audit JSON exceeds the 64 KiB limit"
    : "system audit JSON contains an unsupported value"
}

export class SystemAuditJsonError extends Error {
  readonly code: SystemAuditJsonErrorCode

  constructor(code: SystemAuditJsonErrorCode, options?: ErrorOptions) {
    super(toSystemAuditJsonErrorMessage(code), options)
    this.name = "SystemAuditJsonError"
    this.code = code
    Object.freeze(this)
  }
}

export class InvalidSystemAuditEventError extends Error {
  readonly code = "invalid_system_audit_event"

  constructor(cause?: unknown) {
    super("System audit event is not canonical", cause === undefined ? {} : { cause })
    this.name = "InvalidSystemAuditEventError"
  }
}

export class InvalidOidcClientRegistryError extends Error {
  readonly code = "invalid_oidc_client_registry"

  constructor() {
    super("OIDC client registry is not canonical")
    this.name = "InvalidOidcClientRegistryError"
  }
}

export class InvalidMcpRedirectUriConfigurationError extends Error {
  readonly code = "invalid_mcp_redirect_uri_configuration"

  constructor() {
    super("MCP redirect URI configuration is not canonical")
    this.name = "InvalidMcpRedirectUriConfigurationError"
  }
}

export const invalidAccountReasons = Object.freeze([
  "invalid_shape",
  "token_version_exhausted",
  "transition_before_last_update",
  "update_before_creation",
] as const)

export type InvalidAccountReason = (typeof invalidAccountReasons)[number]

export class InvalidAccountError extends Error {
  readonly code = "invalid_account" as const

  constructor(
    readonly reason: InvalidAccountReason,
    cause?: unknown,
  ) {
    super("invalid_account", { cause })
    this.name = "InvalidAccountError"
    Object.freeze(this)
  }
}

export const invalidSessionReasons = Object.freeze([
  "expiration_not_after_creation",
  "expired",
  "invalid_clock",
  "invalid_rotation_successor",
  "invalid_shape",
  "not_yet_valid",
  "revocation_before_creation",
  "revocation_before_rotation",
  "revoked",
  "rotated",
  "rotation_at_or_after_expiration",
  "rotation_before_creation",
  "transition_before_last_update",
] as const)

export type InvalidSessionReason = (typeof invalidSessionReasons)[number]

export class InvalidSessionError extends Error {
  readonly code = "invalid_session" as const

  constructor(
    readonly reason: InvalidSessionReason,
    cause?: unknown,
  ) {
    super("invalid_session", { cause })
    this.name = "InvalidSessionError"
    Object.freeze(this)
  }
}

export type SystemCapabilityActivationProblem = Readonly<{
  code:
    | "capability_not_implemented"
    | "duplicate_enabled_capability"
    | "duplicate_implemented_capability"
    | "invalid_activation_shape"
    | "missing_required_activation"
    | "missing_required_implementation"
    | "unknown_enabled_capability"
    | "unknown_implemented_capability"
  capability: string | null
}>

export class InvalidSystemCapabilityActivationError extends Error {
  readonly code = "invalid_system_capability_activation" as const
  readonly problems: ReadonlyArray<SystemCapabilityActivationProblem>

  constructor(problems: ReadonlyArray<SystemCapabilityActivationProblem>) {
    super("invalid_system_capability_activation")
    this.name = "InvalidSystemCapabilityActivationError"
    this.problems = Object.freeze(problems.map((problem) => Object.freeze({ ...problem })))
    Object.freeze(this)
  }
}

export const invalidIamGraphReasons = Object.freeze([
  "duplicate_binding_id",
  "duplicate_role_id",
  "invalid_shape",
  "unknown_binding_role",
] as const)

export type InvalidIamGraphReason = (typeof invalidIamGraphReasons)[number]

export class InvalidIamGraphError extends Error {
  readonly code = "invalid_iam_graph" as const

  constructor(readonly reason: InvalidIamGraphReason) {
    super("invalid_iam_graph")
    this.name = "InvalidIamGraphError"
    Object.freeze(this)
  }
}

export class InvalidEmailError extends Error {
  readonly code = "invalid_email" as const

  constructor() {
    super("invalid_email")
    this.name = "InvalidEmailError"
    Object.freeze(this)
  }
}

export type InvalidOidcScopeReason = "invalid_scope" | "openid_scope_required" | "unsupported_scope"

export class InvalidOidcScopeError extends Error {
  readonly code = "invalid_oidc_scope" as const

  constructor(readonly reason: InvalidOidcScopeReason) {
    super(reason)
    this.name = "InvalidOidcScopeError"
    Object.freeze(this)
  }
}

export class InvalidOidcIssuerError extends Error {
  readonly code = "invalid_oidc_issuer" as const

  constructor() {
    super("unknown_oidc_issuer")
    this.name = "InvalidOidcIssuerError"
    Object.freeze(this)
  }
}

export const invalidIamRoleReasons = Object.freeze([
  "duplicate_permissions",
  "invalid_shape",
  "managed_role_mutation",
  "permissions_not_sorted",
  "update_before_creation",
  "update_before_last_update",
] as const)

export type InvalidIamRoleReason = (typeof invalidIamRoleReasons)[number]

export class InvalidIamRoleError extends Error {
  readonly code = "invalid_iam_role" as const

  constructor(
    readonly reason: InvalidIamRoleReason,
    cause?: unknown,
  ) {
    super("invalid_iam_role", { cause })
    this.name = "InvalidIamRoleError"
    Object.freeze(this)
  }
}

export const invalidRoleBindingReasons = Object.freeze([
  "invalid_shape",
  "revocation_before_creation",
  "transition_before_last_update",
] as const)

export type InvalidRoleBindingReason = (typeof invalidRoleBindingReasons)[number]

export class InvalidRoleBindingError extends Error {
  readonly code = "invalid_role_binding" as const

  constructor(
    readonly reason: InvalidRoleBindingReason,
    cause?: unknown,
  ) {
    super("invalid_role_binding", { cause })
    this.name = "InvalidRoleBindingError"
    Object.freeze(this)
  }
}

export const invalidIdentityBindingReasons = Object.freeze([
  "activation_before_creation",
  "invalid_shape",
  "revocation_before_activation",
  "revocation_before_creation",
  "revoked_identity_activation",
] as const)

export type InvalidIdentityBindingReason = (typeof invalidIdentityBindingReasons)[number]

export class InvalidIdentityBindingError extends Error {
  readonly code = "invalid_identity_binding" as const

  constructor(
    readonly reason: InvalidIdentityBindingReason,
    cause?: unknown,
  ) {
    super("invalid_identity_binding", { cause })
    this.name = "InvalidIdentityBindingError"
    Object.freeze(this)
  }
}

export const invalidNotificationDeliveryBatchReasons = Object.freeze([
  "duplicate_delivery_id",
  "duplicate_message_recipient",
  "invalid_shape",
] as const)

export type InvalidNotificationDeliveryBatchReason =
  (typeof invalidNotificationDeliveryBatchReasons)[number]

export class InvalidNotificationDeliveryBatchError extends Error {
  readonly code = "invalid_notification_delivery_batch" as const

  constructor(
    readonly reason: InvalidNotificationDeliveryBatchReason,
    cause?: unknown,
  ) {
    super("invalid_notification_delivery_batch", { cause })
    this.name = "InvalidNotificationDeliveryBatchError"
    Object.freeze(this)
  }
}

export const invalidNotificationDeliveryReasons = Object.freeze([
  "invalid_shape",
  "read_before_delivery",
  "transition_before_last_update",
] as const)

export type InvalidNotificationDeliveryReason = (typeof invalidNotificationDeliveryReasons)[number]

export class InvalidNotificationDeliveryError extends Error {
  readonly code = "invalid_notification_delivery" as const

  constructor(
    readonly reason: InvalidNotificationDeliveryReason,
    cause?: unknown,
  ) {
    super("invalid_notification_delivery", { cause })
    this.name = "InvalidNotificationDeliveryError"
    Object.freeze(this)
  }
}

export const invalidNotificationMessageReasons = Object.freeze(["invalid_shape"] as const)

export type InvalidNotificationMessageReason = (typeof invalidNotificationMessageReasons)[number]

export class InvalidNotificationMessageError extends Error {
  readonly code = "invalid_notification_message" as const

  constructor(
    readonly reason: InvalidNotificationMessageReason,
    cause?: unknown,
  ) {
    super("invalid_notification_message", { cause })
    this.name = "InvalidNotificationMessageError"
    Object.freeze(this)
  }
}

export type InvalidSystemProposalCode =
  | "digest_mismatch"
  | "invalid_chronology"
  | "invalid_json"
  | "invalid_shape"
  | "payload_too_large"

export class InvalidSystemProposalError extends Error {
  readonly code: InvalidSystemProposalCode

  constructor(code: InvalidSystemProposalCode, options?: ErrorOptions) {
    super(code, options)
    this.name = "InvalidSystemProposalError"
    this.code = code
  }
}

export const invalidSystemWorkflowReasons = Object.freeze([
  "invalid_shape",
  "invalid_chronology",
  "invalid_transition",
  "duplicate_candidate",
  "candidate_excluded",
  "attestation_mismatch",
  "duplicate_attestation",
  "ineligible_decider",
  "decision_pending",
  "delegation_to_self",
  "authorization_expired",
  "authorization_already_used",
  "proposal_digest_mismatch",
] as const)

export type InvalidSystemWorkflowReason = (typeof invalidSystemWorkflowReasons)[number]

export class InvalidSystemWorkflowError extends Error {
  readonly code = "invalid_system_workflow"

  constructor(
    readonly reason: InvalidSystemWorkflowReason,
    cause?: unknown,
  ) {
    super("invalid_system_workflow", { cause })
    this.name = "InvalidSystemWorkflowError"
    Object.freeze(this)
  }
}

export type InvalidSystemPasswordReason = "password_too_long" | "password_too_short"

export class InvalidSystemPasswordError extends Error {
  readonly code = "invalid_system_password" as const

  constructor(readonly reason: InvalidSystemPasswordReason) {
    super(reason)
    this.name = "InvalidSystemPasswordError"
    Object.freeze(this)
  }
}

export type InvalidSystemAccessTokenSecretReason = "missing" | "placeholder" | "too_short"

export class InvalidSystemAccessTokenSecretError extends Error {
  readonly code = "invalid_system_access_token_secret" as const

  constructor(readonly reason: InvalidSystemAccessTokenSecretReason) {
    super(reason)
    this.name = "InvalidSystemAccessTokenSecretError"
    Object.freeze(this)
  }
}

export class InvalidSystemCliIdentityRedirectUriError extends Error {
  readonly code = "invalid_system_cli_identity_redirect_uri" as const

  constructor() {
    super("invalid_system_cli_identity_redirect_uri")
    this.name = "InvalidSystemCliIdentityRedirectUriError"
    Object.freeze(this)
  }
}
