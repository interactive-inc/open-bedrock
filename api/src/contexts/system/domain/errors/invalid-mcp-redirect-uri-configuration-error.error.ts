import { DomainError } from "@system/domain/errors/domain-error.error"

export class InvalidMcpRedirectUriConfigurationError extends DomainError {
  readonly code = "invalid_mcp_redirect_uri_configuration"

  constructor() {
    super("MCP redirect URI configuration is not canonical")
    this.name = "InvalidMcpRedirectUriConfigurationError"
  }
}
