const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
const PASSWORD_LENGTH = 12

export class InitialPasswordGenerator {
  static generate(): string {
    const randomValues = crypto.getRandomValues(new Uint32Array(PASSWORD_LENGTH))
    let password = ""

    for (const value of randomValues) {
      password += PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]
    }

    return password
  }
}
