export type OidcClient = Readonly<{
  id: string
  name: string
  redirectUris: ReadonlyArray<string>
}>

export type OidcClientRegistry = Readonly<Record<string, ReadonlyArray<OidcClient>>>

type Props = Readonly<{ issuer: string; clientId: string; redirectUri: string }>

const maximumClientsPerIssuer = 1_000
const maximumRedirectUrisPerClient = 100

/** issuer、client ID、redirect URIを完全一致で検証し、immutableなclient snapshotを返す。 */
export class OidcClientPolicy {
  static resolve(props: Props, registry: OidcClientRegistry): OidcClient | null {
    if (!OidcClientPolicy.hasValidProps(props) || !OidcClientPolicy.isPlainRecord(registry)) {
      return null
    }

    const clientsDescriptor = Object.getOwnPropertyDescriptor(registry, props.issuer)
    if (
      clientsDescriptor === undefined ||
      !("value" in clientsDescriptor) ||
      !Array.isArray(clientsDescriptor.value) ||
      clientsDescriptor.value.length > maximumClientsPerIssuer
    ) {
      return null
    }

    const clients: OidcClient[] = []
    const clientIds = new Set<string>()

    for (const input of clientsDescriptor.value) {
      const client = OidcClientPolicy.parseClient(input)
      if (client === null || clientIds.has(client.id)) return null

      clientIds.add(client.id)
      clients.push(client)
    }

    const client = clients.find((candidate) => candidate.id === props.clientId)
    if (client === undefined || !client.redirectUris.includes(props.redirectUri)) return null

    return client
  }

  private static hasValidProps(props: Props): boolean {
    return (
      OidcClientPolicy.isPlainRecord(props) &&
      typeof props.issuer === "string" &&
      props.issuer.length > 0 &&
      props.issuer.length <= 2_048 &&
      typeof props.clientId === "string" &&
      props.clientId.length > 0 &&
      props.clientId.length <= 255 &&
      typeof props.redirectUri === "string" &&
      props.redirectUri.length > 0 &&
      props.redirectUri.length <= 2_048
    )
  }

  private static parseClient(value: unknown): OidcClient | null {
    if (!OidcClientPolicy.isPlainRecord(value)) return null

    const descriptors = Object.getOwnPropertyDescriptors(value)
    const id = OidcClientPolicy.readString(descriptors, "id")
    const name = OidcClientPolicy.readString(descriptors, "name")
    const redirectUris = OidcClientPolicy.readDataValue(descriptors, "redirectUris")

    if (
      id === null ||
      id.length === 0 ||
      id.length > 255 ||
      name === null ||
      name.trim().length === 0 ||
      name.length > 200 ||
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0 ||
      redirectUris.length > maximumRedirectUrisPerClient
    ) {
      return null
    }

    const parsedRedirectUris: string[] = []
    for (const redirectUri of redirectUris) {
      if (
        typeof redirectUri !== "string" ||
        !OidcClientPolicy.isAllowedRedirectUri(redirectUri) ||
        parsedRedirectUris.includes(redirectUri)
      ) {
        return null
      }
      parsedRedirectUris.push(redirectUri)
    }

    return Object.freeze({
      id,
      name,
      redirectUris: Object.freeze(parsedRedirectUris),
    })
  }

  private static isAllowedRedirectUri(value: string): boolean {
    if (value.length === 0 || value.length > 2_048) return false

    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return false
    }

    if (parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") return false
    if (parsed.protocol === "https:") return true

    return parsed.protocol === "http:" && OidcClientPolicy.isLoopbackHostname(parsed.hostname)
  }

  private static isLoopbackHostname(hostname: string): boolean {
    return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost"
  }

  private static readString(descriptors: PropertyDescriptorMap, key: string): string | null {
    const value = OidcClientPolicy.readDataValue(descriptors, key)

    return typeof value === "string" ? value : null
  }

  private static readDataValue(descriptors: PropertyDescriptorMap, key: string): unknown {
    const descriptor = descriptors[key]

    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined
  }

  private static isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false

    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null
  }
}
