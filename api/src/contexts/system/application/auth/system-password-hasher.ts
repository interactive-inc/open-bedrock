export type SystemPasswordHasher = Readonly<{
  hash: (password: string) => Promise<string | Error>
}>
