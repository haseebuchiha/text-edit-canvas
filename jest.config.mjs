import nextJest from "next/jest.js"

const createJestConfig = nextJest({
  dir: "./",
})

const config = {
  coverageProvider: "v8",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
}

export default createJestConfig(config)
