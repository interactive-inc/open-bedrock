import { McpGrantTokenService } from "@/contexts/system/infrastructure/auth/mcp-grant-token.service"
import { JwtSecretMissingApplicationError } from "@/contexts/system/application/auth/errors"
type Props = Readonly<{
  accountId: string
  tokenVersion: number
  challenge: string
  secret: string | undefined
}>

export class CreateMcpGrant {
  async execute(props: Props) {
    if (props.secret === undefined || props.secret.length === 0) {
      return new JwtSecretMissingApplicationError()
    }

    const grant = await McpGrantTokenService.create(
      props.accountId,
      props.tokenVersion,
      props.challenge,
      props.secret,
    )

    return { item: { grant } }
  }
}
