import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
    ignorePatterns: [".agents/**"],
  },
  lint: {
    ignorePatterns: [".agents/**"],
    options: {
      typeAware: true,
    },
  },
})
