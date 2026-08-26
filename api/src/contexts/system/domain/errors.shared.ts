export type SystemAuditJsonErrorCode = "invalid_json" | "payload_too_large"
export type SystemAttachmentErrorKind =
  | "not_found"
  | "payload_too_large"
  | "unexpected"
  | "unprocessable"
  | "unavailable"
  | "validation"
export function toSystemAuditJsonErrorMessage(code: SystemAuditJsonErrorCode): string {
  return code === "payload_too_large"
    ? "system audit JSON exceeds the 64 KiB limit"
    : "system audit JSON contains an unsupported value"
}
export const invalidAccountReasons = Object.freeze([
  "account_closed",
  "invalid_closed_state",
  "invalid_shape",
  "token_version_exhausted",
  "transition_before_last_update",
  "update_before_creation",
] as const)
export type InvalidAccountReason = (typeof invalidAccountReasons)[number]
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
export const invalidIamGraphReasons = Object.freeze([
  "duplicate_binding_id",
  "duplicate_role_id",
  "invalid_shape",
  "unknown_binding_role",
] as const)
export type InvalidIamGraphReason = (typeof invalidIamGraphReasons)[number]
export type InvalidOidcScopeReason = "invalid_scope" | "openid_scope_required" | "unsupported_scope"
export const invalidIamRoleReasons = Object.freeze([
  "duplicate_permissions",
  "invalid_shape",
  "managed_role_mutation",
  "permissions_not_sorted",
  "update_before_creation",
  "update_before_last_update",
] as const)
export type InvalidIamRoleReason = (typeof invalidIamRoleReasons)[number]
export const invalidRoleBindingReasons = Object.freeze([
  "invalid_shape",
  "revocation_before_creation",
  "transition_before_last_update",
] as const)
export type InvalidRoleBindingReason = (typeof invalidRoleBindingReasons)[number]
export const invalidIdentityBindingReasons = Object.freeze([
  "activation_before_creation",
  "invalid_shape",
  "revocation_before_activation",
  "revocation_before_creation",
  "revoked_identity_activation",
] as const)
export type InvalidIdentityBindingReason = (typeof invalidIdentityBindingReasons)[number]
export const invalidNotificationDeliveryBatchReasons = Object.freeze([
  "duplicate_delivery_id",
  "duplicate_message_recipient",
  "invalid_shape",
] as const)
export type InvalidNotificationDeliveryBatchReason =
  (typeof invalidNotificationDeliveryBatchReasons)[number]
export const invalidNotificationDeliveryReasons = Object.freeze([
  "invalid_shape",
  "read_before_delivery",
  "transition_before_last_update",
] as const)
export type InvalidNotificationDeliveryReason = (typeof invalidNotificationDeliveryReasons)[number]
export const invalidNotificationMessageReasons = Object.freeze(["invalid_shape"] as const)
export type InvalidNotificationMessageReason = (typeof invalidNotificationMessageReasons)[number]
export type InvalidSystemProposalCode =
  | "digest_mismatch"
  | "invalid_chronology"
  | "invalid_json"
  | "invalid_shape"
  | "payload_too_large"
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
export type InvalidSystemPasswordReason = "password_too_long" | "password_too_short"
export type InvalidSystemAccessTokenSecretReason = "missing" | "placeholder" | "too_short"
