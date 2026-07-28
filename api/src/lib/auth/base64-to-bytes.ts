/** base64 文字列を Uint8Array に戻す。 */
export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)

  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}
