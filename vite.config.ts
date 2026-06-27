import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
    ignorePatterns: [".agents/**", ".claude/**"],
  },
  lint: {
    ignorePatterns: [".agents/**", ".claude/**"],
    options: {
      typeAware: true,
    },
  },
})
