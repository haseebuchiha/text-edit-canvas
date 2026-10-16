# Grader verdicts to check: rewrites

Each item is one rewrite the AI grader failed. The original and rewritten text of every block the grader quotes is shown in full.
Read them and fill in your own verdict: pass if you'd accept the rewrite, fail if you wouldn't.

Source: the gpt-6-luna rewrite run of 15 October, with the meaning check on. 15 verdicts.

## 1. 02-rewrite: "make the whole contract more concise"

Document: 02-maintenance-contract · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Preservation of actionable obligations: Block 68 changes the required initial response. The original says the Contractor “shall first attempt to rectify the fault by remote diagnosis”; the rewrite says it “shall first attempt remote diagnosis.” Attempting to diagnose a fault is not the same as attempting to fix it. A technician could comply with the rewritten first step by diagnosing the fault without attempting remote rectification.
> 2. Obligation strength: That same change weakens the express obligation to attempt a remote fix into an obligation merely to attempt remote diagnosis. The later sentence about when to send a technician does not expressly restore the omitted requirement.
> 3. Added content: No separate material addition is needed to establish the failure; the decisive issue is the weakened obligation in block 68.
> 4. Permissible stylistic changes: Most edits are ordinary concision, but removing “to rectify the fault” changes what the Contractor is expressly required to attempt, rather than merely changing tone or wording.

Block 68 (paragraph), original:

> The Contractor shall first attempt to rectify the fault by remote diagnosis, provided the Equipment concerned allows remote access and the Customer has approved such access in the specific case. If the fault cannot be rectified remotely, the Contractor shall send a qualified technician to the Customer's plant.

Block 68, rewritten:

> The Contractor shall first attempt remote diagnosis if the Equipment allows remote access and the Customer has approved access in the specific case. If remote rectification is not possible, the Contractor shall send a qualified technician to the Customer's plant.

Your verdict: pass / fail

Why (optional):

---

## 2. 03-rewrite: "make the whole agreement more formal"

Document: 03-data-processing-agreement · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. The defined notification-form requirement is not fully preserved. Block [19] defines “Text form” as “a readable declaration made on a durable medium, in particular by email or by a message in the support ticket system.” In block [141], the original requires breach notification “in text form to [EMAIL_1],” but the rewrite requires it “in writing to [EMAIL_1].” This replaces the agreement’s expressly defined standard with a different, undefined form requirement. In this German-law agreement, that can affect what the Processor must provide for a valid notification.
> 2. The same change can strengthen the formality required for breach notification: “in writing” can imply a stricter written-form requirement than the original “in text form.” Keeping the email address does not expressly preserve the defined text-form standard. The other changes to mandatory language, such as “must” to “shall” in [161], preserve the obligation’s force.
> 3. No separate material addition is apparent beyond that changed notification-form requirement. Names, placeholders, amounts, deadlines and substantive procedures otherwise remain intact.
> 4. The remaining edits are permissible formalisation—for example, “Art. 28” becomes “Article 28,” and “support” becomes “assistance”—without a material change in meaning. The change in [141], however, concerns compliance with a notification requirement rather than tone alone.

Block 19 (bullet item), original:

> Text form: a readable declaration on a durable medium, in particular email or a message in the support ticket system.

Block 19, rewritten:

> Text form: a readable declaration made on a durable medium, in particular by email or by a message in the support ticket system.

Block 141 (paragraph), original:

> The Processor shall notify the Controller without undue delay, and in any case within 24 hours of becoming aware of it, of any personal data breach affecting the Controller's data. This applies equally to breaches at a sub-processor. The notification shall be made by telephone to the Controller's IT emergency line [PHONE_1] and in text form to [EMAIL_1].

Block 141, rewritten:

> The Processor shall notify the Controller without undue delay, and in any event within 24 hours after becoming aware of any personal data breach affecting the Controller’s data. The foregoing shall apply equally to breaches occurring at a sub-processor. The notification shall be made by telephone to the Controller’s IT emergency line [PHONE_1] and in writing to [EMAIL_1].

Block 161 (paragraph), original:

> The Controller shall ensure that inspections do not disrupt the Processor's operations more than necessary and that the confidentiality of the Processor's business secrets and the data of its other customers is protected. External auditors must be bound to confidentiality and must not be competitors of the Processor.

Block 161, rewritten:

> The Controller shall ensure that inspections do not disrupt the Processor’s operations more than necessary and that the confidentiality of the Processor’s business secrets and the data of its other customers is protected. External auditors shall be bound by confidentiality obligations and shall not be competitors of the Processor.

Your verdict: pass / fail

Why (optional):

---

## 3. 05-rewrite: "make the whole project plan more concise"

Document: 05-erp-migration-project-plan · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. The rewritten text retains the actionable dates, amounts, thresholds and conditions, including “within ten working days” [43], “at least 98 percent” and “all financial balances” [290], and the unchanged milestone dates and budget figures.
> 2. The principal requirements retain their strength: “custom developments are only permitted if they are approved by the design authority” becomes “custom developments require design authority approval” [20], and overlaps still require approval: “The design authority must approve such overlaps” [174].
> 3. Block [191] adds an operational responsibility. The original says “the cutover runbook is executed, the go-live is carried out at all three sites and the project team provides intensive support for eight weeks.” Only intensive support is explicitly assigned to the project team. The rewrite says “the project team executes the cutover runbook, goes live at all three sites and provides intensive support for eight weeks,” additionally assigning runbook execution and go-live to that team. A reader could consequently understand the team's responsibilities differently.
> 4. The other concision and wording changes do not establish a material difference, but the added responsibility in [191] exceeds a stylistic edit.

Block 20 (paragraph), original:

> The project aims to replace the legacy system with a standardised, future-proof ERP platform that supports the growth strategy of [ORG_1] until at least 2035. The guiding principle is "standard first": the company adapts its processes to the standard of the new system wherever this is economically reasonable, and custom developments are only permitted if they are approved by the design authority.

Block 20, rewritten:

> The project aims to replace the legacy system with a standardised, future-proof ERP platform supporting [ORG_1]'s growth strategy until at least 2035. Under the “standard first” principle, the company adapts its processes to the new system’s standard wherever economically reasonable; custom developments require design authority approval.

Block 43 (numbered item), original:

> The project manager and [ORG_2] assess the impact on schedule, budget, resources and risks within ten working days.

Block 43, rewritten:

> The project manager and [ORG_2] assess schedule, budget, resource and risk impacts within ten working days.

Block 174 (paragraph), original:

> The phases build on each other, but realisation sprints for less complex process areas may start while the design of other areas is still being finalised. Overlaps of this kind must be approved by the design authority.

Block 174, rewritten:

> Phases build on each other, but realisation sprints for less complex process areas may start before design of other areas is finalised. The design authority must approve such overlaps.

Block 191 (paragraph), original:

> In the go-live and hypercare phase, the cutover runbook is executed, the go-live is carried out at all three sites and the project team provides intensive support for eight weeks. During hypercare, the first month-end closing in the new system is supported by consultants of [ORG_2]. At the end of the phase, open tickets, documentation and system responsibility are handed over to IT operations and the business application support team.

Block 191, rewritten:

> During go-live and hypercare, the project team executes the cutover runbook, goes live at all three sites and provides intensive support for eight weeks. [ORG_2] consultants support the first month-end closing in the new system. At phase end, open tickets, documentation and system responsibility are handed over to IT operations and the business application support team.

Block 290 (paragraph), original:

> Each data object has a data owner in the business department who is responsible for cleansing the data in the legacy system and for approving the migration results. The data migration lead coordinates the migration tooling, the mapping rules and the reconciliation reports. A migration test load is only accepted if at least 98 percent of records are loaded without errors and all financial balances reconcile with the legacy system.

Block 290, rewritten:

> Each data object has a business department data owner responsible for legacy-system data cleansing and approval of migration results. The data migration lead coordinates tooling, mapping rules and reconciliation reports. A migration test load is accepted only if at least 98 percent of records load without errors and all financial balances reconcile with the legacy system.

Your verdict: pass / fail

Why (optional):

---

## 4. 06-rewrite: "make the whole report more concise"

Document: 06-quarterly-report · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Preservation of facts: Block [134] changes “the shortage of skilled kitchen staff” to “kitchen staff shortages.” The qualification “skilled” is lost. A shortage of qualified kitchen workers does not necessarily mean a shortage of kitchen workers generally. This changes the stated market condition driving demand for automated and connected cooking solutions.
> 2. Preservation of strength and scope: The same change broadens the claim from a shortage of a particular category of workers to kitchen staffing shortages generally. It is therefore more than a shorter way of expressing the original fact. The other forecasts, conditions, quantities and commitments retain their original force—for example, “most of the required quantities” remains “most required quantities,” and the photovoltaic forecast remains conditional on being “fully operational.”
> 3. No additions: No new numbers, names, placeholders or obligations are introduced. However, the broader assertion “kitchen staff shortages” is not what the original specifically states; it identifies a shortage of skilled staff.
> 4. Permissible concision: Most edits are meaning-preserving compression, such as “Order backlog at 30 September” becoming “Order backlog (30 September)” and “will be included in the consolidated financial statements from the fourth quarter” becoming “will be consolidated from Q4.” Dropping “skilled” is different because it changes the reader’s understanding of the business opportunity.

Block 134 (paragraph), original:

> The most important opportunities arise from the modernisation needs of public institutions, the growing importance of energy-efficient appliances and the shortage of skilled kitchen staff, which increases demand for automated and connected cooking solutions. We do not currently see any risks that could endanger the continued existence of the company.

Block 134, rewritten:

> Key opportunities arise from public institutions’ modernisation needs, the growing importance of energy-efficient appliances, and kitchen staff shortages that increase demand for automated, connected cooking solutions. We currently see no risks that could endanger the company’s continued existence.

Your verdict: pass / fail

Why (optional):

---

## 5. 11-rewrite: "make the whole proposal more formal"

Document: 11-rfp-response · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. The actionable numbers, dates, prices, deadlines, names and conditions are preserved. For example, “valid for 90 days” becomes “remains valid for 90 days,” and “Updated within 60 seconds via the standard connector” becomes “Updated within 60 seconds through the standard connector.”
> 2. Obligations, permissions and limits retain their force: updates still reach production “only after your approval,” and travel expenses remain covered for “up to 160” consultant days, restated as “a maximum of 160.”
> 3. Block [289] adds a more specific business classification: “Technical trade, central warehouse with 28 branches” becomes “Technical wholesaler; central warehouse serving 28 branches.” Technical trade does not necessarily mean wholesale. Calling [ORG_5] a wholesaler introduces a fact not established in the original and could change a reader’s assessment of whether this reference represents a comparable wholesale business.
> 4. The other wording and tone changes are acceptable formalisation, but the added industry classification goes beyond tone.

Block 289 (table cell r4c2), original:

> Technical trade, central warehouse with 28 branches

Block 289, rewritten:

> Technical wholesaler; central warehouse serving 28 branches

Your verdict: pass / fail

Why (optional):

---

## 6. 12-rewrite: "make the whole spec more concise"

Document: 12-product-specification · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. The rewrite preserves the main actionable details, including measurement ranges, deadlines, warranty periods and ordering conditions. However, it changes the force of one maintenance instruction.
> 2. In block [234], the original says, “We recommend a visual inspection of the sensor and its mounting during the regular machine maintenance, at least once a year.” The rewrite says, “Visually inspect the sensor and mounting during regular machine maintenance, at least annually.” Removing “We recommend” turns an explicitly recommended inspection into a direct instruction. A reader could understand annual inspection as required rather than recommended.
> 3. This change introduces a stronger maintenance instruction than the original states, even though the inspection and its frequency are unchanged.
> 4. Most shortening is harmless, but the change in [234] is not merely stylistic: it removes the explicit qualification that establishes the inspection as a recommendation.

Block 234 (paragraph), original:

> The CMS-200 requires no regular maintenance. We recommend a visual inspection of the sensor and its mounting during the regular machine maintenance, at least once a year. The battery status is transmitted with every measurement, and the gateway reports a warning when the expected remaining battery life falls below 90 days.

Block 234, rewritten:

> The CMS-200 requires no regular maintenance. Visually inspect the sensor and mounting during regular machine maintenance, at least annually. Battery status is sent with every measurement; the gateway warns when expected remaining battery life falls below 90 days.

Your verdict: pass / fail

Why (optional):

---

## 7. 15-rewrite: "make the whole curriculum more concise"

Document: 15-training-curriculum · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Not every actionable condition is retained. In block 145, the original requires participants to “train two team members with it,” referring to the standard work instruction they write or revise. The rewrite says only “train two team members,” removing the requirement to use that instruction. A participant could train colleagues on something else and still satisfy the rewritten assignment.
> 2. Some commitments become weaker. In block 214, managers originally “give them the time they need for the assignments”; the rewrite requires only “provide time for assignments.” Providing some time, even if insufficient, now meets the wording. Also, block 207 changes “All training materials, templates and recordings” to “Training materials, templates and presentation recordings,” and block 208 changes “all templates and handouts” to “templates and handouts.” These remove explicit guarantees of complete availability, including translated materials.
> 3. No clear new actionable fact, number, name or obligation is introduced. The failures above concern omitted conditions and weakened commitments rather than additions.
> 4. Most edits are permissible concision—for example, “Curriculum version 2.1” becoming “Version 2.1” in block 2. However, the quoted changes affect what participants must do and what support or materials they can expect, so they are not merely stylistic.

Block 2 (paragraph), original:

> Programme owner: [PERSON_1], Head of Training and Development, [ORG_1]. Curriculum version 2.1, approved by the plant management on [DATE_1].

Block 2, rewritten:

> Programme owner: [PERSON_1], Head of Training and Development, [ORG_1]. Version 2.1, approved by plant management on [DATE_1].

Block 145 (paragraph), original:

> Practical assignment: Participants write or revise one standard work instruction, train two team members with it and update the training matrix of their team.

Block 145, rewritten:

> Practical assignment: Participants write or revise a standard work instruction, train two team members and update their team’s training matrix.

Block 207 (paragraph), original:

> All training materials, templates and recordings of the presentations are available on the learning platform. Participants receive their login details one week before the start of the programme.

Block 207, rewritten:

> Training materials, templates and presentation recordings are available on the learning platform. Participants receive login details one week before the programme starts.

Block 208 (paragraph), original:

> The programme is held in German, but all templates and handouts are also available in English, Polish and Turkish, because a significant number of our team leaders learned German as a second language. Trainers keep the language simple, explain technical terms when they are first used and give participants enough time for questions. Participants who would like additional support, for example with writing A3 reports, can book extra coaching hours with the training department. Shift workers who cannot attend a classroom day because of their shift pattern are released from their shift for that day, and their manager arranges a replacement in good time.

Block 208, rewritten:

> The programme is in German; templates and handouts are also available in English, Polish and Turkish, because a significant number of team leaders learned German as a second language. Trainers use simple language, explain technical terms when first used and allow enough time for questions. Participants who would like additional support, for example with writing A3 reports, can book extra coaching hours with the training department. Shift workers unable to attend a classroom day because of their shift pattern are released from their shift that day; their manager arranges a replacement in good time.

Block 214 (paragraph), original:

> The direct managers nominate the participants, agree the improvement project with them and give them the time they need for the assignments. They attend the final presentation in module 8 and are responsible for the follow-up after the programme. Managers are invited to a two-hour briefing before each run so that they know what their team leaders will learn and how they can support them.

Block 214, rewritten:

> Direct managers nominate participants, agree the improvement project with them and provide time for assignments. They attend module 8's final presentation and are responsible for follow-up after the programme. Managers are invited to a two-hour briefing before each run to learn what team leaders will cover and how to support them.

Your verdict: pass / fail

Why (optional):

---

## 8. 17-rewrite: "make the whole document more formal"

Document: 17-customer-portal-faq · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Preservation of actionable facts: Blocks [8]–[9] introduce a meaningful contradiction about cost. The original asks “Does the customer portal cost anything?” and answers “No,” meaning it is free. The rewrite asks “Is the Customer Portal Free of Charge?” but retains the answer “No.” That now denies that the portal is free, even though the next sentence still says “Use of the customer portal is free of charge for all customers.” A reader could therefore understand the cost differently or be unsure whether charges apply.
> 2. Strength of requirements and permissions: The substantive limits and requirements otherwise remain intact, including “at least twelve characters,” activation “within one working day,” and authentication being “mandatory for all users.” No separate strengthening or weakening is evident.
> 3. No new facts: The revised question paired with “No” introduces the unsupported implication that portal access is not free. The original explicitly says it is free.
> 4. Permitted stylistic changes: Changes such as “gives you access” to “provides access” and “will be happy to help” to “will be pleased to assist you” are acceptable formalisation. However, reversing the polarity of the cost question without changing its answer is not merely stylistic.

Block 8 (heading), original:

> Does the customer portal cost anything?

Block 8, rewritten:

> Is the Customer Portal Free of Charge?

Block 9 (paragraph), original:

> No. Use of the customer portal is free of charge for all customers. You only pay for the products and services you order, at the prices agreed in your contract or shown in the portal.

Block 9, rewritten:

> No. Use of the customer portal is free of charge for all customers. You pay only for the products and services you order, at the prices agreed in your contract or displayed in the portal.

Your verdict: pass / fail

Why (optional):

---

## 9. 18-rewrite: "make the whole guideline more concise"

Document: 18-procurement-guideline · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. An actionable assessment detail is lost in block [109]. The original specifies “parts per million defective, number of complaints”; the rewrite says “defective parts per million; complaints.” Dropping “number of” removes the requirement to use the complaint count in evaluating supplier quality. A reader could instead assess complaints by their nature or severity.
> 2. That same change weakens the specificity of the assessment basis: “number of complaints” is a defined quantitative measure, whereas “complaints” does not require that measure. The other requirements, thresholds, deadlines and permissions appear preserved.
> 3. No new actionable fact or obligation is apparent.
> 4. Most changes are permissible concision, but the loss of “number of” is not merely stylistic because it can change how suppliers are evaluated.

Block 109 (table cell r2c3), original:

> parts per million defective, number of complaints

Block 109, rewritten:

> defective parts per million; complaints

Your verdict: pass / fail

Why (optional):

---

## 10. 20-rewrite: "make the whole document more formal"

Document: 20-customer-case-study · Grader: tone · Verdict: fail

Grader's reasoning:

> 1. The text clearly moves toward a more formal tone. For example, “kick-off” becomes “project initiation,” “The heart of the foundry” becomes “The foundry's central asset,” and “mainly reacted” becomes “primarily responded.” These changes establish a more formal business register.
> 2. The change is not applied evenly. The heading “What's Next” remains unchanged and conversational, unlike the change from “At a Glance” to “Overview.” The closing paragraph also retains its conversational promotional framing: “Would you like to learn” and “Read more.” Changing “find out” to “learn” does not bring that block into line with the more formal register applied elsewhere. Unchanged technical labels and table cells are already appropriately neutral and do not present the same issue.
> 3. The revised prose remains natural and professional overall. Phrases such as “conducted a criticality analysis” and “generated estimated savings” suit a business case study without exaggerated language or unnecessary filler.
> Because the formal tone is not applied evenly across all blocks that needed adjustment, the rewrite does not meet every criterion.

Your verdict: pass / fail

Why (optional):

---

## 11. 20-rewrite: "make the whole document more formal"

Document: 20-customer-case-study · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Preservation of actionable facts: Block [18] loses the explicit fact that a line stoppage stops the entire foundry. The original says, “When the line stops, the entire foundry stops with it”; the rewrite says, “When the line stops, the entire foundry is affected.” Although the specific consequences for furnaces, crews and delivery schedules remain, they do not preserve the statement that the entire foundry stops. A reader could understand the rewrite as describing disruption while other foundry operations continue.
> 2. No weakening or strengthening: The same change weakens the stated operational consequence from a complete foundry stoppage to an unspecified effect. This is a substantive change, not merely more formal wording.
> 3. No unsupported additions: No other substantive new fact, obligation, number, name or placeholder is apparent. For example, “Before implementation” and “After implementation” clarify the table headings consistently with the surrounding comparison.
> 4. Permitted stylistic changes: Changes such as “At a Glance” to “Overview” and “kick-off” to “project initiation” preserve meaning. However, the change from “stops with it” to “is affected” goes beyond tone and changes the reader’s understanding of the operational impact.

Block 18 (paragraph), original:

> [ORG_2] has been producing grey and ductile iron castings for more than 90 years. The heart of the foundry is an automatic moulding line that produces up to 220 sand moulds per hour in three shifts. When the line stops, the entire foundry stops with it: the melting furnaces have to be throttled, the casting crews wait, and delivery dates for customers come under pressure.

Block 18, rewritten:

> [ORG_2] has produced grey and ductile iron castings for more than 90 years. The foundry's core asset is an automatic moulding line that produces up to 220 sand moulds per hour across three shifts. When the line stops, the entire foundry is affected: the melting furnaces must be throttled, casting crews are left waiting, and customer delivery schedules come under pressure.

Your verdict: pass / fail

Why (optional):

---

## 12. L7: "make the whole document more concise"

Document: 07-it-security-policy · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Actionable facts retained: Not fully. In block 261, the original review “defines measures to prevent a recurrence”; the rewrite instead “reviews its causes, response effectiveness and measures to prevent recurrence.” Reviewing measures does not require defining them, so the required outcome of the incident review is lost.
> 2. Requirements neither weakened nor strengthened: Not met. In block 195, the original requires encryption and says the email system “offers a secure send option for this purpose.” The rewrite requires encryption “using the email system's secure send option,” making an available option mandatory. In block 237, “Do not create private copies of shared folders on local drives or external media” becomes “Do not copy shared folders to local drives or external media for private use.” This narrows the prohibition to private-purpose copying, rather than also covering personal local copies made for work.
> 3. No new actionable content: Not met. Block 83 originally says exceptions “are documented and approved by the CISO.” The rewrite says “the CISO must approve and document each exception,” newly assigning documentation specifically to the CISO rather than merely requiring that the exceptions be documented.
> 4. Harmless concision is acceptable: Many edits qualify, such as block 16's “cloud services that have been approved by the IT department” becoming “cloud services approved by the IT department.” However, the changes quoted above affect what readers must do, not merely tone or length.

Block 16 (bullet item), original:

> cloud services that have been approved by the IT department

Block 16, rewritten:

> cloud services approved by the IT department

Block 83 (paragraph), original:

> Every user receives a personal user account. Shared or group accounts are not permitted for office IT. On the shop floor, shared accounts are permitted only on machine terminals where individual logins are technically impossible; these exceptions are documented and approved by the CISO.

Block 83, rewritten:

> Every user has a personal account. Shared or group accounts are prohibited for office IT. On the shop floor, shared accounts are permitted only on machine terminals where individual logins are technically impossible; the CISO must approve and document each exception.

Block 195 (paragraph), original:

> Confidential information must be encrypted when sent to external recipients. The email system offers a secure send option for this purpose. For large files and for information classified as Strictly confidential, the approved secure file exchange platform must be used. Automatic forwarding of business emails to external addresses is technically blocked and not permitted.

Block 195, rewritten:

> Confidential information sent to external recipients must be encrypted using the email system's secure send option. Use the approved secure file exchange platform for large files and information classified as Strictly confidential. Automatic forwarding of business emails to external addresses is technically blocked and not permitted.

Block 237 (bullet item), original:

> Do not create private copies of shared folders on local drives or external media.

Block 237, rewritten:

> Do not copy shared folders to local drives or external media for private use.

Block 261 (paragraph), original:

> After every serious incident, the incident response team carries out a review within four weeks. The review identifies the causes, assesses how well the response worked and defines measures to prevent a recurrence. The findings are shared with the affected departments and, in anonymised form, with all employees where they offer a useful lesson. The CISO tracks the agreed measures until they are completed.

Block 261, rewritten:

> Within four weeks of every serious incident, the incident response team reviews its causes, response effectiveness and measures to prevent recurrence. Findings are shared with affected departments and, in anonymised form, with all employees when they offer a useful lesson. The CISO tracks agreed measures to completion.

Your verdict: pass / fail

Why (optional):

---

## 13. LF: "make the whole document more formal"

Document: 07-it-security-policy · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. Preservation of actionable facts: Block [245] narrows the assurance against disciplinary consequences. The original says, “Nobody will face disciplinary consequences for promptly reporting a mistake made in good faith”; the rewrite says, “No employee will face disciplinary consequences for promptly reporting a mistake made in good faith.” This matters because [6] expressly extends the policy to non-employees, including “external service providers.” Those readers no longer receive the same explicit assurance when deciding whether to report a mistake.
> 2. No weakening or strengthening: The same change weakens the scope of that protection from “Nobody” to “No employee.” It is not merely a more formal expression.
> 3. No new substantive content: I found no separate material addition of a fact, obligation, number, name or placeholder.
> 4. Permissible stylistic changes: The other revisions largely formalise wording while retaining meaning, but the narrowed protection quoted above changes what affected readers can understand about the consequences of reporting.

Block 6 (paragraph), original:

> This policy applies to all employees of [ORG_1] at all sites, including the headquarters in [LOCATION_1], the production plants in [LOCATION_2] and [LOCATION_3], and the logistics centre in [LOCATION_4]. It also applies to apprentices, working students, interns, temporary workers and external service providers who are given access to our information or IT systems. External parties are bound to it through their contracts and through the confidentiality declaration they sign before access is granted.

Block 6, rewritten:

> This policy applies to all employees of [ORG_1] at all sites, including the headquarters in [LOCATION_1], the production plants in [LOCATION_2] and [LOCATION_3], and the logistics centre in [LOCATION_4]. It also applies to apprentices, working students, interns, temporary workers and external service providers who are granted access to our information or IT systems. External parties are bound by this policy through their contracts and the confidentiality declaration they sign before access is granted.

Block 245 (paragraph), original:

> Speed is critical when handling incidents. Employees must report every suspected incident immediately, even if they are not sure whether it is really an incident and even if they may have caused it themselves. Nobody will face disciplinary consequences for promptly reporting a mistake made in good faith.

Block 245, rewritten:

> A prompt response is critical when handling incidents. Employees must report every suspected incident immediately, even if they are unsure whether it constitutes an incident and even if they may have caused it themselves. No employee will face disciplinary consequences for promptly reporting a mistake made in good faith.

Your verdict: pass / fail

Why (optional):

---

## 14. SF: "make the whole document more formal"

Document: sample-offer · Grader: meaning · Verdict: fail

Grader's reasoning:

> 1. The concrete details are retained, including “12 people,” the participating departments, all named placeholders, the Week 1/3/5 schedule, the prices and total, and confirmation “by [DATE_1]” with the agenda sent “one week before the workshop.”
> 2. Block [6] strengthens the customer's position: “The customer wants a workshop for 12 people” becomes “The customer requires a workshop for 12 people.” A stated preference is presented as a requirement, which could cause a reader to treat the workshop as mandatory rather than desired. This is a substantive change, not merely a more formal tone.
> 3. No separate new number, name, placeholder, service or deadline is introduced. However, the requirement asserted by “requires” is not established by the original “wants.”
> 4. The remaining changes are consistent with formalization without materially changing meaning—for example, “Once confirmed” becomes “Upon confirmation,” and “Written summary with recommended next steps” becomes “Written summary setting out recommended next steps.” These do not remedy the strengthening in block [6].

Block 6 (paragraph), original:

> The customer wants a workshop for 12 people.

Block 6, rewritten:

> The customer requires a workshop for 12 people.

Your verdict: pass / fail

Why (optional):

---

## 15. SF: "make the whole document more formal"

Document: sample-offer · Grader: tone · Verdict: fail

Grader's reasoning:

> 1. The rewrite clearly moves towards a more formal tone. For example, “We sat down with the customer” becomes “Following a discussion with the customer,” “need a review” becomes “require review,” and “Kind regards” becomes “Yours sincerely.”
> 2. The change is not fully consistent. Block [6], “The customer wants a workshop for 12 people,” retains the original conversational phrasing, despite the surrounding paragraphs being formalised. “The customer requests a workshop for 12 participants” would better match the revised register. The unchanged headings, table entries and already professional service descriptions do not otherwise require changes.
> 3. The revised wording remains natural and professional overall. Expressions such as “The applicable legal framework” and “Written summary setting out recommended next steps” suit a business offer without exaggeration or unnecessary filler.
> The uneven treatment of block [6] means the consistency criterion is not met.

Your verdict: pass / fail

Why (optional):

---
