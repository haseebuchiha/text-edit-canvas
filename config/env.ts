import { z } from "zod"

const GATEWAY_MODEL_PATTERN = /^[^\s/]+\/[^\s/]+$/u

const environmentSchema = z.object({
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//u, "MONGODB_URI must start with mongodb:// or mongodb+srv://")
    .default("mongodb://127.0.0.1:27017/pryvet"),
})

const unsetWhenBlank = (setting: unknown) =>
  typeof setting === "string" && setting.trim() === "" ? undefined : setting

const optionalSetting = z.preprocess(unsetWhenBlank, z.string().trim().optional())

const gatewayKeySchema = z.object({ AI_GATEWAY_API_KEY: optionalSetting })

const gatewayEnvironmentSchema = z.object({
  AI_GATEWAY_API_KEY: z.string().trim().min(1),
  AI_GATEWAY_MODEL: z
    .string()
    .trim()
    .regex(GATEWAY_MODEL_PATTERN, "AI_GATEWAY_MODEL must be provider/model, like openai/gpt-5.6-luna"),
})

const paidEvalsSchema = z.object({ EVALS_ALLOW_PAID: optionalSetting })

const proxyEnvironmentSchema = z.object({
  LLM_BASE_URL: z.url(),
  LLM_API_KEY: optionalSetting,
  LLM_MODEL: z.string().trim().min(1),
})

export const readEnvironment = () => environmentSchema.parse(process.env)

export const readGatewayApiKey = () => gatewayKeySchema.safeParse(process.env).data?.AI_GATEWAY_API_KEY

export const readGatewayEnvironment = () => gatewayEnvironmentSchema.safeParse(process.env).data

export const readProxyEnvironment = () => proxyEnvironmentSchema.safeParse(process.env).data

export const readEvalsAllowPaid = () => paidEvalsSchema.safeParse(process.env).data?.EVALS_ALLOW_PAID === "1"
