import { existsSync } from "node:fs"
import { join } from "node:path"
import nextJest from "next/jest.js"

const ROOT = join(import.meta.dirname, "..", "..")
const LOCAL_ENV_FILE = join(ROOT, ".env.local")

if (existsSync(LOCAL_ENV_FILE)) process.loadEnvFile(LOCAL_ENV_FILE)

const createJestConfig = nextJest({ dir: ROOT })

const config = {
  rootDir: ROOT,
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/evals/**/*.eval.ts"],
}

export default createJestConfig(config)
