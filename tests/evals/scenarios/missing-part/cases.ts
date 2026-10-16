import type { EvalCase } from "@/tests/evals/run-case"

export type MissingPartCase = EvalCase & { replyMentions: string[] }

export const MISSING_PART_CASES: MissingPartCase[] = [
  {
    id: "02-missing-part",
    document: "02-maintenance-contract",
    instruction: "extend the non-solicitation clause to 24 months",
    why: "The contract has no non-solicitation clause; the confidentiality clause in 7.1 is a different obligation and must not be edited instead.",
    replyMentions: ["solicitation"],
  },
  {
    id: "05-missing-part",
    document: "05-erp-migration-project-plan",
    instruction: "add hypercare to the glossary",
    why: "The plan has no glossary; the RACI legend in block 103 is not one.",
    replyMentions: ["glossary"],
  },
  {
    id: "L9",
    document: "07-it-security-policy",
    instruction: "edit the appendix",
    why: "Known gap 4: the policy has no appendix, and gpt-6-luna sometimes edits the last section instead of saying so.",
    replyMentions: ["appendix"],
  },
  {
    id: "09-missing-part",
    document: "09-sop-incoming-goods-inspection",
    instruction: "update the revision history",
    why: "The SOP has only a version line in its header (block 6), no revision history. Asking which revision details to add is fine; editing the header is not.",
    replyMentions: ["revision"],
  },
  {
    id: "11-missing-part",
    document: "11-rfp-response",
    instruction: "shorten the cover letter",
    why: "The proposal has no cover letter; it opens with a submission line (block 2) and an executive summary.",
    replyMentions: ["cover letter"],
  },
  {
    id: "14-missing-part",
    document: "14-incident-report",
    instruction: "add an entry for transaction log to the glossary",
    why: "The report has no glossary; the term is only explained in passing under Immediate Cause, which must not be edited instead.",
    replyMentions: ["glossary"],
  },
  {
    id: "17-missing-part",
    document: "17-customer-portal-faq",
    instruction: "shorten the glossary at the end",
    why: "The FAQ has no glossary; it ends with the Contact section, which must not be shortened instead.",
    replyMentions: ["glossary"],
  },
  {
    id: "19-missing-part",
    document: "19-travel-expense-policy",
    instruction: "shorten the definitions section",
    why: "The policy has no definitions section; the definition of a business trip sits in section 2, Scope, which must not be shortened instead.",
    replyMentions: ["definition"],
  },
  {
    id: "S9",
    document: "sample-offer",
    instruction: "edit the appendix",
    why: "Known gap 4: the document has no appendix, and gpt-6-luna sometimes edits another part instead of saying so.",
    replyMentions: ["appendix"],
  },
]
