export type SystemPasswordMaterialService = Readonly<{
  dummyHash: string
  needsRehash: (passwordHash: string) => boolean
  verify: (password: string, passwordHash: string) => Promise<boolean | Error>
}>
