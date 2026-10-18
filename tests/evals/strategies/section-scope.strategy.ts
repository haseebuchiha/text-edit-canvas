import { streamSectionScope } from "@/tests/evals/strategies/edit-strategies"
import { testStrategy } from "@/tests/evals/strategies/strategy-runs"

testStrategy({ name: "b-section-scope", streamTurn: streamSectionScope })
