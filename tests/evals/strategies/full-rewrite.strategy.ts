import { streamFullRewrite } from "@/tests/evals/strategies/edit-strategies"
import { testStrategy } from "@/tests/evals/strategies/strategy-runs"

testStrategy({ name: "a-full-rewrite", streamTurn: streamFullRewrite })
