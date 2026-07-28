/** Uint8Array を base64 文字列に変換する（Workers / Bun の標準 btoa 経由）。 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}
