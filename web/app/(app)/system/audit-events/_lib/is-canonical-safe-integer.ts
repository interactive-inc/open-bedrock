const signedSafeIntegerPattern = /^(?:0|-?[1-9][0-9]*)$/u

export function isCanonicalSafeInteger(value: string): boolean {
  return signedSafeIntegerPattern.test(value) && Number.isSafeInteger(Number(value))
}
