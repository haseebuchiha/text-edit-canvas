import type { EvalCase } from "@/tests/evals/run-case"

type ExactChange = { blockContaining: string; becomesOneOf: string[] }

type PartialChange = { blockContaining: string; newTextIncludes: string[] }

export type ChangeTextCase = EvalCase & {
  changes: (ExactChange | PartialChange)[]
  goneEverywhere?: string[]
}

export const CHANGE_TEXT_CASES: ChangeTextCase[] = [
  {
    id: "01-edit",
    document: "01-it-support-offer",
    instruction: "lower the helpdesk price to EUR 22.00 per user per month",
    why: "The row total and the monthly total have to follow: 190 x EUR 22.00 = EUR 4,180.00, and the total falls by EUR 380.00 to EUR 8,512.50. The one-time setup price of EUR 6,400.00 stays.",
    changes: [
      { blockContaining: "EUR 24.00", becomesOneOf: ["EUR 22.00"] },
      { blockContaining: "EUR 4,560.00", becomesOneOf: ["EUR 4,180.00"] },
      { blockContaining: "EUR 8,892.50", becomesOneOf: ["EUR 8,512.50"] },
    ],
  },
  {
    id: "01-everywhere",
    document: "01-it-support-offer",
    instruction: "replace customer with client throughout",
    why: "Ten blocks hold the word, one of them a heading; blocks 5, 20 and 70 hold it twice and block 72 three times.",
    changes: [
      {
        blockContaining: "[ORG_1] has supported mid-sized",
        becomesOneOf: [
          "[ORG_1] has supported mid-sized manufacturing companies in the region for more than 15 years. Today we look after around 4,200 workstations for 38 clients, most of them family-owned businesses with between 100 and 600 employees. We know that a client like you does not need a large IT department, but does need a reliable partner who answers the phone, understands production and keeps costs predictable.",
        ],
      },
      {
        blockContaining: "Until now, IT has",
        becomesOneOf: [
          "Until now, IT has been run by two internal employees who also support the ERP system and the CAD workstations in engineering. One of them will retire at the end of next year. During our meeting, the client described the following challenges:",
        ],
      },
      {
        blockContaining: "The customer's goal is",
        becomesOneOf: [
          "The client's goal is to relieve the internal team of routine work so that it can focus on the ERP system, engineering applications and digital projects. At the same time, the client wants a clear view of costs and service quality.",
        ],
      },
      {
        blockContaining: "Questions about the ERP",
        becomesOneOf: [
          "Questions about the ERP system and the CAD software are forwarded to the internal team of the client, as agreed.",
        ],
      },
      {
        blockContaining: "During the first eight",
        becomesOneOf: [
          "During the first eight weeks after go-live, a named service manager from [ORG_1] holds a short weekly call with the client to review open tickets and adjust processes where needed.",
        ],
      },
      {
        blockContaining: "We measure the service",
        becomesOneOf: [
          "We measure the service levels every month and present the results in a short quarterly review with the client. If we miss the response time for Priority 1 or Priority 2 tickets in more than 5 percent of cases in a quarter, the client receives a credit of 5 percent of the monthly fee for that quarter.",
        ],
      },
      { blockContaining: "Responsibilities of the Customer", becomesOneOf: ["Responsibilities of the Client"] },
      {
        blockContaining: "To deliver these services,",
        becomesOneOf: [
          "To deliver these services, we rely on the cooperation of the client. In particular, the client will name two contacts in the internal IT team who can take decisions on priorities and changes, grant our technicians remote access through the agreed VPN, and inform us in good time about new sites, larger orders of devices or changes to the ERP system. Software licences remain the responsibility of the client unless they are purchased through [ORG_1].",
        ],
      },
      {
        blockContaining: "Our general terms and",
        becomesOneOf: [
          "Our general terms and conditions and our data processing agreement apply. We process personal data only on behalf of the client and in accordance with the GDPR.",
        ],
      },
      {
        blockContaining: "We would be pleased",
        becomesOneOf: [
          "We would be pleased to welcome [ORG_2] as a client. For questions, please contact [PERSON_2] at [EMAIL_1] or [PHONE_1].",
        ],
      },
    ],
    goneEverywhere: ["customer"],
  },
  {
    id: "02-edit",
    document: "02-maintenance-contract",
    instruction: "raise the wear parts allowance in the flat fee to EUR 3,000 per quarter",
    why: "Clause 5.1 (block 139) refers to this limit only as 'the value specified in clause 2.3', so it stays unchanged.",
    changes: [
      {
        blockContaining: "Wear parts consumed during",
        becomesOneOf: [
          "Wear parts consumed during preventive maintenance are included in the flat fee pursuant to clause 5.1, up to a value of EUR 3,000 per calendar quarter. Spare parts for corrective maintenance and wear parts exceeding this value shall be invoiced separately at the Contractor's list prices less a discount of 12 percent.",
        ],
      },
    ],
  },
  {
    id: "02-highlight",
    document: "02-maintenance-contract",
    instruction: "make this in writing",
    why: "'In text form' also appears in blocks 11, 152, 163 and 178, but only the highlighted clause on non-original parts may change.",
    highlight: { blockContaining: "Spare parts shall be", text: "in text form" },
    changes: [
      {
        blockContaining: "Spare parts shall be",
        becomesOneOf: [
          "Spare parts shall be original parts of the respective Equipment manufacturer or parts of equivalent quality. The use of non-original parts requires the prior consent of the Customer in writing for safety-relevant components.",
          "Spare parts shall be original parts of the respective Equipment manufacturer or parts of equivalent quality. The use of non-original parts requires the prior consent of the Customer in written form for safety-relevant components.",
        ],
      },
    ],
  },
  {
    id: "03-everywhere",
    document: "03-data-processing-agreement",
    instruction: "rename the Main Agreement to Master Agreement throughout",
    why: "Thirteen blocks name it, including three list items; block 4 has it twice (once in lower case where it is first introduced) and so does block 26.",
    changes: [
      {
        blockContaining: "The Controller is a",
        becomesOneOf: [
          'The Controller is a logistics company with approximately 750 employees at four locations in Germany. It operates contract warehousing, regional distribution and road freight services for industrial and retail customers. The Controller uses a cloud-based software solution for human resources administration and payroll accounting, which is provided and operated by the Processor under the master agreement "HR and Payroll Cloud Services" dated [DATE_1] (the "Master Agreement").',
          'The Controller is a logistics company with approximately 750 employees at four locations in Germany. It operates contract warehousing, regional distribution and road freight services for industrial and retail customers. The Controller uses a cloud-based software solution for human resources administration and payroll accounting, which is provided and operated by the Processor under the Master Agreement "HR and Payroll Cloud Services" dated [DATE_1] (the "Master Agreement").',
        ],
      },
      {
        blockContaining: "This Agreement implements the",
        becomesOneOf: [
          "This Agreement implements the requirements of Article 28 of the General Data Protection Regulation (GDPR) and the German Federal Data Protection Act (BDSG). In the event of any conflict between this Agreement and the Master Agreement, the provisions of this Agreement shall take precedence with regard to data protection matters.",
        ],
      },
      {
        blockContaining: "Services: the HR and",
        becomesOneOf: [
          "Services: the HR and payroll services provided by the Processor under the Master Agreement, including hosting, operation, maintenance and support.",
        ],
      },
      {
        blockContaining: "The specific services, service",
        becomesOneOf: [
          "The specific services, service levels and the scope of functions are described in the Master Agreement and its service description. The employee self-service portal allows employees of the Controller to view their payslips, submit holiday requests and update selected master data such as their address and bank details. Access to the portal is protected by individual user accounts and two-factor authentication. The Controller decides which employees receive access and which functions are activated.",
        ],
      },
      {
        blockContaining: "This Agreement does not",
        becomesOneOf: [
          "This Agreement does not create any independent payment obligations. All remuneration for the services is governed exclusively by the Master Agreement.",
        ],
      },
      {
        blockContaining: "This Agreement takes effect",
        becomesOneOf: [
          "This Agreement takes effect on the date of signature by both Parties and shall remain in force for as long as the Processor processes personal data on behalf of the Controller under the Master Agreement. The termination of the Master Agreement automatically terminates this Agreement, subject to the obligations in Section 10 regarding deletion and return of data, which shall survive termination.",
        ],
      },
      {
        blockContaining: "The Controller shall issue",
        becomesOneOf: [
          "The Controller shall issue its instructions in a clear and complete manner and shall bear any additional costs caused by instructions that go beyond the agreed scope of services. Additional effort shall be invoiced in accordance with the hourly rates set out in the Master Agreement, provided that the Processor has informed the Controller of the expected effort in advance and the Controller has approved it in text form.",
        ],
      },
      {
        blockContaining: "Support with data subject",
        becomesOneOf: [
          "Support with data subject requests is included in the service fee as long as the effort does not exceed four hours per calendar month. Additional effort shall be invoiced in accordance with the Master Agreement, unless the request results from an error or a breach of this Agreement by the Processor.",
        ],
      },
      {
        blockContaining: "After the end of",
        becomesOneOf: [
          "After the end of the provision of the services, the Processor shall, at the choice of the Controller, delete all personal data or return it to the Controller and delete existing copies, unless Union or Member State law requires the storage of the personal data. The Controller shall notify the Processor of its choice no later than 30 days before the end of the Master Agreement.",
        ],
      },
      {
        blockContaining: "On request, the Processor",
        becomesOneOf: [
          "On request, the Processor shall support the Controller in migrating the data to a new provider. This transition support includes the provision of the export files, an explanation of the data structure and up to two coordination meetings with the new provider. Effort beyond this scope shall be invoiced in accordance with the Master Agreement.",
        ],
      },
      {
        blockContaining: "The Parties shall be",
        becomesOneOf: [
          "The Parties shall be liable to the data subjects in accordance with Article 82 GDPR. In the internal relationship, liability is governed by the provisions of the Master Agreement, with the exception that limitations of liability shall not apply to damage resulting from culpable breaches of this Agreement by the Processor or its sub-processors.",
        ],
      },
      {
        blockContaining: "The service description of",
        becomesOneOf: ["The service description of the Master Agreement"],
      },
      {
        blockContaining: "The general terms and",
        becomesOneOf: ["The general terms and conditions of the Master Agreement"],
      },
    ],
    goneEverywhere: ["Main Agreement"],
  },
  {
    id: "03-highlight",
    document: "03-data-processing-agreement",
    instruction: "make this 60 days",
    why: "'30 days' also appears in blocks 125 and 133 with other meanings, and only the highlighted deadline may change.",
    highlight: { blockContaining: "After the end of", text: "30 days" },
    changes: [
      {
        blockContaining: "After the end of",
        becomesOneOf: [
          "After the end of the provision of the services, the Processor shall, at the choice of the Controller, delete all personal data or return it to the Controller and delete existing copies, unless Union or Member State law requires the storage of the personal data. The Controller shall notify the Processor of its choice no later than 60 days before the end of the Main Agreement.",
        ],
      },
    ],
  },
  {
    id: "04-edit",
    document: "04-steering-committee-minutes",
    instruction: "correct the interface test result: 220 of 236 test cases passed, not 214",
    why: "The remaining cases drop from 22 to 16, both in block 34 and in action item 3 (block 81).",
    changes: [
      {
        blockContaining: "[PERSON_4] reported that the",
        becomesOneOf: [
          "[PERSON_4] reported that the interface between the warehouse management system and the ERP system has passed the first integration test. 220 of 236 test cases were completed successfully. The remaining 16 cases mainly concern returns and stock corrections and are expected to be resolved by the end of the month.",
        ],
      },
      { blockContaining: "Resolve the remaining 22", becomesOneOf: ["Resolve the remaining 16 interface test cases"] },
    ],
  },
  {
    id: "04-everywhere",
    document: "04-steering-committee-minutes",
    instruction: "change steering committee to project board everywhere",
    why: "Eight blocks name it, including the title, where it is capitalised, and an attendee list item.",
    changes: [
      {
        blockContaining: "Minutes: Steering Committee Meeting,",
        becomesOneOf: ["Minutes: Project Board Meeting, Warehouse Automation Project"],
      },
      {
        blockContaining: "[PERSON_1], Chief Operating Officer,",
        becomesOneOf: ["[PERSON_1], Chief Operating Officer, chair of the project board"],
      },
      {
        blockContaining: "The steering committee was",
        becomesOneOf: [
          "The project board was quorate. The minutes of the previous meeting were approved without changes.",
        ],
      },
      {
        blockContaining: "[PERSON_2] presented the current",
        becomesOneOf: [
          "[PERSON_2] presented the current project status. The installation of the automated small parts warehouse with 18,000 container spaces has been completed mechanically. The two shuttle aisles and the conveyor loop to the picking stations have been installed, and the electrical commissioning started two weeks ago. The project is therefore about three weeks behind the baseline schedule approved by the project board in March.",
        ],
      },
      {
        blockContaining: "The overrun results from",
        becomesOneOf: [
          "The overrun results from additional costs for fire protection measures required by the building authority (EUR 95,000) and from extended support by the integrator during the longer commissioning phase (EUR 55,000). [PERSON_6] confirmed that [ORG_2] will bear the costs of the additional commissioning team itself, since the delay was caused by its subcontractor. The project board asked the project manager to check whether the remaining contingency of EUR 60,000 can partially cover the additional costs.",
        ],
      },
      {
        blockContaining: "The steering committee made",
        becomesOneOf: ["The project board made the following decisions:"],
      },
      {
        blockContaining: "[PERSON_3] suggested organising a",
        becomesOneOf: [
          "[PERSON_3] suggested organising a visit to the new warehouse for the sales team in December, so that they can explain the improved delivery times to customers. The project board welcomed the proposal. There was no further business.",
        ],
      },
      {
        blockContaining: "The next meeting of",
        becomesOneOf: [
          "The next meeting of the project board will take place on [DATE_6] at 14:00. The presentation slides and the updated risk register are available in the project folder. Comments on these minutes should be sent to [PERSON_2] within one week.",
        ],
      },
    ],
    goneEverywhere: ["steering committee"],
  },
  {
    id: "05-edit",
    document: "05-erp-migration-project-plan",
    instruction: "the project sponsor can now approve contingency use up to EUR 150,000",
    why: "Only the amount changes: rewording the sentence fails, because the app tells the model to leave everything else exactly as it is. Block 47's EUR 25,000 is the sponsor's limit for change requests, not for the contingency, and must stay.",
    changes: [
      {
        blockContaining: "Budget control is carried",
        becomesOneOf: [
          "Budget control is carried out monthly by the project controller. The use of the contingency requires the approval of the project sponsor for amounts up to EUR 150,000 and of the steering committee for higher amounts. Licence costs from the second year onwards are part of the regular IT budget.",
        ],
      },
    ],
  },
  {
    id: "05-highlight",
    document: "05-erp-migration-project-plan",
    instruction: "make this four weeks",
    why: "Block 181 also says 'three weeks' for the sprint length, which must stay.",
    highlight: { blockContaining: "Delay of the go-live:", text: "three weeks" },
    changes: [
      {
        blockContaining: "Delay of the go-live:",
        becomesOneOf: [
          "Delay of the go-live: A delay beyond the planned date would extend parallel maintenance costs for the legacy system. Mitigation: contingency of four weeks in the plan and a clearly defined fallback go-live window.",
        ],
      },
    ],
  },
  {
    id: "06-everywhere",
    document: "06-quarterly-report",
    instruction: "change order backlog to order book everywhere",
    why: "Block 26 is a cell in the key figures table and keeps its capital letter: Order book at 30 September.",
    changes: [
      {
        blockContaining: "The third quarter of",
        becomesOneOf: [
          "The third quarter of 2026 was the strongest quarter in the history of [ORG_1]. Despite a still hesitant investment climate in the hotel and catering industry, we increased revenue by 8.4 percent to EUR 68.4 million compared with the same quarter of the previous year. Order intake grew even faster, by 10.4 percent to EUR 71.2 million, which means that our order book reached a new record of EUR 94.6 million at the end of September.",
        ],
      },
      {
        blockContaining: "In the first nine",
        becomesOneOf: [
          "In the first nine months of the year, revenue amounted to EUR 197.5 million, an increase of 7.2 percent on the prior-year period. EBIT for the nine months was EUR 15.8 million after EUR 13.1 million in the previous year. On the basis of these results and the strong order book, we confirm our full-year forecast and now expect to reach the upper half of the forecast range.",
        ],
      },
      { blockContaining: "Order backlog at 30", becomesOneOf: ["Order book at 30 September"] },
      {
        blockContaining: "The order backlog of",
        becomesOneOf: [
          "The order book of EUR 94.6 million provides a solid basis for the fourth quarter, which is traditionally our strongest in terms of revenue. At the same time, we see the following risks and opportunities for the rest of the year:",
        ],
      },
    ],
    goneEverywhere: ["order backlog"],
  },
  {
    id: "06-highlight",
    document: "06-quarterly-report",
    instruction: "make this June 2027",
    why: "Block 107 also mentions April, as the month the collective agreement came into force, and must stay; only the publication date of the sustainability report changes.",
    highlight: { blockContaining: "At our own sites,", text: "April 2027" },
    changes: [
      {
        blockContaining: "At our own sites,",
        becomesOneOf: [
          "At our own sites, electricity consumption per unit produced fell by 6 percent compared with the previous year. Once the new photovoltaic system is fully operational, around 22 percent of the electricity required at the assembly plant will be generated on site. In September, we also switched the company car fleet guideline to electric and hybrid vehicles for all new orders. The sustainability report for 2026, which for the first time will be prepared in line with the European reporting standards, is scheduled for publication in June 2027.",
        ],
      },
    ],
  },
  {
    id: "L3",
    document: "07-it-security-policy",
    instruction: "change customer to client everywhere",
    why: "Known gaps 1 and 2: the edit for block 69 once went to the table cell next to it (fixed in round 13), and blocks 3, 78 and 260 hold the word twice, of which runs changed only the first.",
    changes: [
      {
        blockContaining: "This policy sets out",
        becomesOneOf: [
          "This policy sets out the binding rules for the secure use of information and IT systems at [ORG_1]. As a supplier of injection-moulded plastic parts to vehicle manufacturers, we handle drawings, prototype data and production parameters that our clients entrust to us under strict confidentiality obligations. Our TISAX assessment, our client contracts and the General Data Protection Regulation all require that we protect this information in a demonstrable and consistent way. This policy is the foundation for that protection, and every one of our roughly 1,400 employees is expected to know and follow it.",
        ],
      },
      {
        blockContaining: "Where a customer contract",
        becomesOneOf: [
          "Where a client contract sets stricter requirements than this policy, for example for prototype parts subject to special protection, the stricter requirements take precedence for the information covered by that contract. Project managers must inform the information security team at the start of such a project so that the necessary additional measures can be planned.",
        ],
      },
      {
        blockContaining: "For each important information",
        becomesOneOf: [
          "For each important information asset, such as client drawings, cost calculations or personnel records, an information owner is named in the asset inventory. The information owner classifies the information, decides who may access it and approves exceptions. Information owners are usually the head of the department that creates or primarily uses the information.",
        ],
      },
      {
        blockContaining: "Information whose disclosure could",
        becomesOneOf: ["Information whose disclosure could harm [ORG_1] or its clients"],
      },
      {
        blockContaining: "Customer drawings, quotations, cost",
        becomesOneOf: ["Client drawings, quotations, cost calculations, personnel data"],
      },
      {
        blockContaining: "Before Confidential or Strictly",
        becomesOneOf: [
          "Before Confidential or Strictly confidential information is shared with an external party, such as a toolmaker, a testing laboratory or an engineering consultancy, a non-disclosure agreement must be in place. The purchasing department keeps a register of signed agreements, and employees can check there whether a valid agreement exists. If no agreement exists, the information may not be shared until the agreement has been signed by both parties. Information received from clients may only be passed on to subcontractors if the client contract allows this.",
        ],
      },
      {
        blockContaining: "Generative AI tools deserve",
        becomesOneOf: [
          "Generative AI tools deserve particular attention. They can help employees draft texts, summarise documents or write code, but anything entered into a public AI service may be stored and used by the provider. Employees may therefore use only the AI assistant provided by the IT department for business content, and only for information classified as Public or Internal. Results produced by AI tools must be checked for accuracy before they are used, especially in documents sent to clients. The detailed rules are described in the AI usage guideline on the digital workplace page.",
        ],
      },
      {
        blockContaining: "Email is the most",
        becomesOneOf: [
          "Email is the most common route for attacks on companies such as ours. Phishing emails often look convincing and may appear to come from clients, suppliers or colleagues. Employees must check the sender address carefully, be suspicious of unexpected attachments and links, and never enter their password on a page they reached by clicking a link in an email.",
        ],
      },
      {
        blockContaining: "The IT department assesses",
        becomesOneOf: [
          "The IT department assesses each report and, in the case of a serious incident, involves the CISO and the incident response team. Incidents involving personal data are reported to the data protection officer, [PERSON_2], without delay, so that the 72-hour notification deadline under the GDPR can be met. Incidents that affect client information are reported to the client in accordance with the contractual requirements. The full process is described in the incident response procedure.",
        ],
      },
      {
        blockContaining: "Violations of this policy",
        becomesOneOf: [
          "Violations of this policy can cause significant damage to [ORG_1], to our clients and to our employees. Depending on the severity and circumstances, violations may lead to consequences under labour law, up to and including dismissal, and may in addition result in civil or criminal liability. Any sanctions are applied in accordance with the applicable works agreements and with the involvement of the works council.",
        ],
      },
      {
        blockContaining: "The CISO reviews this",
        becomesOneOf: [
          "The CISO reviews this policy at least once a year and whenever significant changes occur, such as new legal requirements, new client requirements, the results of the TISAX assessment or lessons learned from serious incidents. Changes are approved by the management board and communicated to all employees via the intranet and the employee newsletter.",
        ],
      },
    ],
    goneEverywhere: ["customer"],
  },
  {
    id: "L4",
    document: "07-it-security-policy",
    instruction: "workstations now lock automatically after five minutes of inactivity",
    changes: [
      {
        blockContaining: "Employees must lock their",
        becomesOneOf: [
          "Employees must lock their screen whenever they leave their workstation, even for a short time. Workstations lock automatically after five minutes of inactivity. Confidential documents must not be left on desks at the end of the working day, and whiteboards in meeting rooms must be wiped after meetings in which confidential topics were discussed.",
        ],
      },
    ],
  },
  {
    id: "L5",
    document: "07-it-security-policy",
    instruction: "the IT hotline number is now [PHONE_2]",
    changes: [
      {
        blockContaining: "The loss or theft",
        becomesOneOf: [
          "The loss or theft of a mobile device must be reported immediately to the IT hotline on [PHONE_2], even outside office hours. Early reporting allows the IT department to block access and wipe the device before data can be misused.",
        ],
      },
      {
        blockContaining: "Call the IT hotline",
        becomesOneOf: [
          "Call the IT hotline on [PHONE_2] and describe what happened, when it happened and which systems are affected.",
        ],
      },
    ],
    goneEverywhere: ["[PHONE_1]"],
  },
  {
    id: "L6",
    document: "07-it-security-policy",
    instruction: "change the version to 4.3 in the document header",
    changes: [
      {
        blockContaining: "Document owner: [PERSON_1], Chief",
        becomesOneOf: [
          "Document owner: [PERSON_1], Chief Information Security Officer, [ORG_1]. Version: 4.3. Classification: Internal. Approved by the management board on: [DATE_1].",
        ],
      },
    ],
  },
  {
    id: "L10",
    document: "07-it-security-policy",
    instruction: "unused accounts are now deactivated after 30 days instead of 60",
    why: "Known gap 6: some runs read only 'User Accounts' and added a sentence to block 84. Block 221, a patching deadline of 60 days, must stay.",
    changes: [
      {
        blockContaining: "The IT department additionally",
        becomesOneOf: [
          "The IT department additionally checks every month for accounts that have not been used for 30 days. Such accounts are deactivated after the responsible manager has been informed. Accounts of employees on long-term leave, such as parental leave, are suspended for the duration of the absence and reactivated on request.",
        ],
      },
    ],
  },
  {
    id: "L11",
    document: "07-it-security-policy",
    instruction: "rename section 9 to Backup and Restore",
    why: "Known gap 14: an edited heading must stay a short heading on one line.",
    changes: [{ blockContaining: "9. Backup and Recovery", becomesOneOf: ["9. Backup and Restore"] }],
  },
  {
    id: "L12",
    document: "07-it-security-policy",
    instruction: "make this four hours",
    why: "Known gap 15: with a highlight, only the highlighted text may change.",
    highlight: { blockContaining: "External service providers receive", text: "eight hours" },
    changes: [
      {
        blockContaining: "External service providers receive",
        becomesOneOf: [
          "External service providers receive remote access only for the duration of a specific maintenance task. The access is activated by the IT department on request, is protected by multi-factor authentication and is deactivated automatically after four hours. Permanent remote access for external parties requires the written approval of the CISO.",
          "External service providers receive remote access only for the duration of a specific maintenance task. The access is activated by the IT department on request, is protected by multi-factor authentication and is deactivated automatically after 4 hours. Permanent remote access for external parties requires the written approval of the CISO.",
        ],
      },
    ],
  },
  {
    id: "08-edit",
    document: "08-employee-onboarding-handbook",
    instruction: "shorten the probation period to four months",
    why: "Blocks 161, 163 and 294 also say six months, but those are the overtime time-off window, the holiday accrual period and the buddy programme, and must stay.",
    changes: [
      {
        blockContaining: "The probation period is",
        becomesOneOf: [
          "The probation period is four months unless your contract states otherwise. During this time, either party may terminate the employment relationship with two weeks' notice. Your manager will inform you of the result of the final assessment at least four weeks before the probation period ends. After the probation period you become eligible for the full range of benefits and for internal training programmes.",
        ],
      },
    ],
  },
  {
    id: "08-everywhere",
    document: "08-employee-onboarding-handbook",
    instruction: "change calibration laboratory to calibration lab everywhere",
    why: "The term sits in two bullet items and a cell of the first-week schedule, and block 244 holds it twice.",
    changes: [
      {
        blockContaining: "Calibration and service: an",
        becomesOneOf: [
          "Calibration and service: an accredited calibration lab, on-site service and training for customers",
        ],
      },
      {
        blockContaining: "For positions in the",
        becomesOneOf: [
          "For positions in the calibration lab: proof of your training on measurement uncertainty, if available",
        ],
      },
      {
        blockContaining: "Tour of the site",
        becomesOneOf: ["Tour of the site including production and calibration lab"],
      },
      {
        blockContaining: "There is no general",
        becomesOneOf: [
          "There is no general dress code in the offices. Most colleagues dress casually; for customer visits and trade fairs, business attire is expected. In production, in the warehouse and in the calibration lab, workwear and personal protective equipment are mandatory. The company provides workwear, safety shoes and safety glasses free of charge and has the workwear cleaned weekly. In the calibration lab, additional rules apply to reduce dust and temperature fluctuations; you will be instructed accordingly if you work there.",
        ],
      },
      {
        blockContaining: "The company doctor holds",
        becomesOneOf: [
          "The company doctor holds consultation hours at the site every Tuesday and Thursday. Consultations are confidential and take place during working time. Employees in certain areas, such as the paint shop or the calibration lab, attend mandatory occupational health check-ups; HR will invite you if this applies to you.",
        ],
      },
    ],
    goneEverywhere: ["calibration laboratory"],
  },
  {
    id: "09-edit",
    document: "09-sop-incoming-goods-inspection",
    instruction: "under skip-lot inspection, inspect every third lot instead of every fifth",
    why: "The skip-lot frequency is stated twice, in the definition (block 40) and under special cases (block 170), and both must change; the twelve lots in block 205 are the entry threshold and stay.",
    changes: [
      {
        blockContaining: "Skip-lot inspection: a reduced",
        becomesOneOf: [
          "Skip-lot inspection: a reduced inspection frequency for suppliers and materials with a proven record of good quality; only every third lot is inspected.",
        ],
      },
      {
        blockContaining: "Deliveries under skip-lot inspection:",
        becomesOneOf: [
          "Deliveries under skip-lot inspection: the goods receipt is posted as usual, but the ERP system only creates an inspection lot for every third delivery. All other deliveries are released after the visual and document check.",
        ],
      },
    ],
  },
  {
    id: "09-highlight",
    document: "09-sop-incoming-goods-inspection",
    instruction: "make this 10 working days",
    why: "The same block also has a deadline of two working days, and block 193 keeps records for 15 years; only the 8D report deadline changes.",
    highlight: { blockContaining: "Nonconforming goods are handled", text: "15 working days" },
    changes: [
      {
        blockContaining: "Nonconforming goods are handled",
        becomesOneOf: [
          "Nonconforming goods are handled in accordance with the procedure for nonconforming products, SOP-QM-009. The supplier quality engineer creates a supplier complaint in the ERP system within two working days and informs the supplier. The complaint contains a description of the defect, photos, measurement results and the affected quantity. The supplier must submit an initial response with containment measures within 48 hours and a complete 8D report within 10 working days.",
        ],
      },
    ],
  },
  {
    id: "10-everywhere",
    document: "10-job-posting",
    instruction: "change maintenance team to maintenance department everywhere",
    why: "Block 5 holds the term twice and two bullet items hold it once each; the plain word 'maintenance' elsewhere, as in the title, stays.",
    changes: [
      {
        blockContaining: "[ORG_1] is looking for",
        becomesOneOf: [
          "[ORG_1] is looking for an industrial electrician (m/f/d) to join our maintenance department at the plant in [LOCATION_1] as soon as possible. The position is permanent and full-time, with 37.5 hours per week in a three-shift system.",
        ],
      },
      {
        blockContaining: "[ORG_1] is a family-owned",
        becomesOneOf: [
          "[ORG_1] is a family-owned company in its third generation, manufacturing plastic injection-moulded parts for the automotive, medical technology and household appliance industries. With around 480 employees and more than 90 injection moulding machines, we supply customers throughout Europe. Our production runs around the clock, which is why a reliable and well-organised maintenance department is at the heart of our plant.",
        ],
      },
      {
        blockContaining: "Our maintenance team currently",
        becomesOneOf: [
          "Our maintenance department currently consists of 22 colleagues: electricians, industrial mechanics and automation technicians who look after our machines, robots, peripheral equipment and building services. We value short decision-making paths, a friendly working atmosphere and the willingness to try out new solutions. In the past two years, the maintenance department has introduced a digital maintenance planning system and condition monitoring for our largest machines, and we want to continue on this path with you.",
        ],
      },
      {
        blockContaining: "Willingness to work in",
        becomesOneOf: [
          "Willingness to work in three shifts and to take part in the on-call service of the maintenance department",
        ],
      },
      {
        blockContaining: "A structured onboarding with",
        becomesOneOf: ["A structured onboarding with a personal mentor from the maintenance department"],
      },
      {
        blockContaining: "After reviewing your documents,",
        becomesOneOf: [
          "After reviewing your documents, we will invite you to a first interview with HR and the head of maintenance. In a second step, you will spend a trial day with the maintenance department to get to know the plant, the machines and your future colleagues. We aim to make a decision within three weeks of receiving your application.",
        ],
      },
    ],
    goneEverywhere: ["maintenance team"],
  },
  {
    id: "10-highlight",
    document: "10-job-posting",
    instruction: "make this two weeks",
    why: "The posting also mentions a three-shift system and work in three shifts; only the time to a hiring decision changes.",
    highlight: { blockContaining: "After reviewing your documents,", text: "three weeks" },
    changes: [
      {
        blockContaining: "After reviewing your documents,",
        becomesOneOf: [
          "After reviewing your documents, we will invite you to a first interview with HR and the head of maintenance. In a second step, you will spend a trial day with the maintenance team to get to know the plant, the machines and your future colleagues. We aim to make a decision within two weeks of receiving your application.",
        ],
      },
    ],
  },
  {
    id: "11-edit",
    document: "11-rfp-response",
    instruction: "extend the stabilisation phase to month 15",
    why: "The project length in block 5 has to follow (14 to 15 months); the 14 must-have requirements in block 11 and the 14 years of experience in block 203 must stay.",
    changes: [
      {
        blockContaining: "Stabilisation and handover (months",
        becomesOneOf: [
          "Stabilisation and handover (months 12 to 15): hypercare support on site, optimisation of strategies and handover to the support organisation.",
        ],
      },
      {
        blockContaining: "With this proposal, [ORG_1]",
        becomesOneOf: [
          "With this proposal, [ORG_1] offers a standard warehouse management solution that will be configured for all three sites, integrated with your existing ERP system and introduced in three waves over 15 months. The solution covers goods receipt, putaway, replenishment, picking, packing, shipping, inventory and returns, and it supports both the bulky goods typical of your heating business, such as boilers and storage tanks, and the many small parts of your sanitary range.",
        ],
      },
    ],
  },
  {
    id: "11-everywhere",
    document: "11-rfp-response",
    instruction: "change bulky goods to oversized goods everywhere",
    why: "The term sits in a heading, two bullet items and two cells of the compliance matrix, and block 61 holds it twice; 'Bulky items' in block 61 may change or stay.",
    changes: [
      {
        blockContaining: "With this proposal, [ORG_1]",
        becomesOneOf: [
          "With this proposal, [ORG_1] offers a standard warehouse management solution that will be configured for all three sites, integrated with your existing ERP system and introduced in three waves over 14 months. The solution covers goods receipt, putaway, replenishment, picking, packing, shipping, inventory and returns, and it supports both the oversized goods typical of your heating business, such as boilers and storage tanks, and the many small parts of your sanitary range.",
        ],
      },
      {
        blockContaining: "Bulky goods such as",
        becomesOneOf: [
          "Oversized goods such as boilers, radiators and storage tanks tie up a large share of floor space and require special handling and transport equipment.",
        ],
      },
      {
        blockContaining: "Putaway and slotting: system-directed",
        becomesOneOf: [
          "Putaway and slotting: system-directed putaway based on article size, turnover and weight, with dedicated zones for oversized goods",
        ],
      },
      { blockContaining: "Handling of Bulky Goods", becomesOneOf: ["Handling of Oversized Goods"] },
      {
        blockContaining: "Bulky goods are a",
        becomesOneOf: [
          "Oversized goods are a particular feature of your business. Boilers, heat pumps, storage tanks and long radiators cannot be picked like small parts, and they often need a forklift or a special trolley. The solution therefore manages oversized goods in separate zones with their own putaway and picking strategies. Each article is assigned a handling class based on its dimensions and weight, and the system only creates transport orders for employees and equipment that are qualified for that class. Bulky items for the same delivery route are staged in dedicated loading areas, so that drivers can load them in the right order. At your central warehouse, we expect this to reduce the floor space used for staging by around 20 percent, because items no longer wait in the aisles for the loading of the next vehicle.",
          "Oversized goods are a particular feature of your business. Boilers, heat pumps, storage tanks and long radiators cannot be picked like small parts, and they often need a forklift or a special trolley. The solution therefore manages oversized goods in separate zones with their own putaway and picking strategies. Each article is assigned a handling class based on its dimensions and weight, and the system only creates transport orders for employees and equipment that are qualified for that class. Oversized items for the same delivery route are staged in dedicated loading areas, so that drivers can load them in the right order. At your central warehouse, we expect this to reduce the floor space used for staging by around 20 percent, because items no longer wait in the aisles for the loading of the next vehicle.",
        ],
      },
      {
        blockContaining: "Strategies for small parts,",
        becomesOneOf: ["Strategies for small parts, pallets and oversized goods"],
      },
      { blockContaining: "Separate handling of bulky", becomesOneOf: ["Separate handling of oversized goods"] },
    ],
    goneEverywhere: ["bulky goods"],
  },
  {
    id: "12-edit",
    document: "12-product-specification",
    instruction: "the low-battery warning should now come at 120 days of remaining life instead of 90",
    why: "The messages table repeats the 90-day threshold in block 250, so it has to change together with block 234.",
    changes: [
      {
        blockContaining: "The CMS-200 requires no",
        becomesOneOf: [
          "The CMS-200 requires no regular maintenance. We recommend a visual inspection of the sensor and its mounting during the regular machine maintenance, at least once a year. The battery status is transmitted with every measurement, and the gateway reports a warning when the expected remaining battery life falls below 120 days.",
        ],
      },
      { blockContaining: "expected remaining life below", becomesOneOf: ["expected remaining life below 120 days"] },
    ],
  },
  {
    id: "12-highlight",
    document: "12-product-specification",
    instruction: "make this 12 months",
    why: "The highlight is the battery warranty; the 36-month sensor warranty in the same sentence must stay.",
    highlight: { blockContaining: "[ORG_1] grants a warranty", text: "24 months" },
    changes: [
      {
        blockContaining: "[ORG_1] grants a warranty",
        becomesOneOf: [
          "[ORG_1] grants a warranty of 36 months from delivery on the sensor, excluding the battery, which is covered for 12 months. Warranty claims are handled through the service portal. Customers with a service contract receive a replacement sensor within two working days, without waiting for the analysis of the returned device. Our application engineers also support customers with the selection of measuring points, the interpretation of alarms and the integration into existing maintenance processes.",
        ],
      },
    ],
  },
  {
    id: "13-everywhere",
    document: "13-internal-newsletter",
    instruction: "replace colleagues with team members throughout",
    why: "Block 2 has the word twice, once at the start and once at the end of the paragraph.",
    changes: [
      {
        blockContaining: "News, dates and stories",
        becomesOneOf: [
          "News, dates and stories from [ORG_1] for all team members at our sites in [LOCATION_1] and [LOCATION_2]. Editorial team: [PERSON_1] (Corporate Communications), with contributions from team members across the company.",
        ],
      },
      {
        blockContaining: "Dear colleagues, the summer",
        becomesOneOf: [
          "Dear team members, the summer was busy: our order books are well filled, the new production hall has opened its doors and 19 young people have started their training with us. In this issue we look back at the opening, introduce our new apprentices, invite you to the health day and explain why you should be particularly careful with emails over the coming weeks. As always, we welcome your ideas for the next issue. Simply send them to [EMAIL_1].",
        ],
      },
      {
        blockContaining: "After 14 months of",
        becomesOneOf: [
          "After 14 months of construction, our new production hall in [LOCATION_1] was officially opened on [DATE_1]. Around 400 team members, their families and guests from the town council celebrated the opening with a tour of the hall, a barbecue and live music from our company band.",
        ],
      },
      {
        blockContaining: "What changes for you?",
        becomesOneOf: [
          "What changes for you? The team members from the rented hall moved in during the first two weeks of September. From October, the canteen in building A will also serve the new hall, and a new footpath with lighting connects both buildings. A site plan with all changes is available on the intranet.",
        ],
      },
      {
        blockContaining: "During their first week,",
        becomesOneOf: [
          'During their first week, the newcomers got to know the company, completed their safety training and spent a day building a small remote-controlled vehicle in mixed teams. Our training manager [PERSON_2] was impressed: "The teams worked together as if they had known each other for years." Please give our new team members a warm welcome when you meet them in the workshops and offices.',
        ],
      },
      {
        blockContaining: "We are also looking",
        becomesOneOf: [
          "We are also looking for runners and walkers for the city company run on [DATE_4]. Last year 74 team members took part, and we would like to beat that number. The company pays the entry fee and provides running shirts. Register by the end of the month with [PERSON_3] in HR.",
        ],
      },
      {
        blockContaining: "In the third quarter,",
        becomesOneOf: [
          "In the third quarter, team members submitted 58 ideas to our company suggestion scheme, and 21 of them have already been implemented. The idea of the quarter came from the paint shop: [PERSON_9] and [PERSON_10] proposed a new hanging pattern for the drying line that allows 12 percent more parts per run. The idea saves around EUR 34,000 per year and earned the team a bonus of EUR 3,400. Congratulations! Do you have an idea that makes work safer, easier or cheaper? Submit it in the employee portal or drop it into one of the idea boxes next to the time clocks.",
        ],
      },
      {
        blockContaining: "Please note the following",
        becomesOneOf: [
          "Please note the following dates in your calendar: the works meeting takes place on [DATE_5] in the new production hall, the second blood donation of the year is on [DATE_6] in the first aid room of building B, the deadline for submitting ideas for the company suggestion scheme is [DATE_7], and our Christmas party for all team members will be held on [DATE_8] in the staff restaurant.",
        ],
      },
      {
        blockContaining: "The next issue of",
        becomesOneOf: [
          "The next issue of the newsletter will appear in January. Until then, we wish all team members and their families a pleasant autumn.",
        ],
      },
    ],
    goneEverywhere: ["colleagues"],
  },
  {
    id: "13-highlight",
    document: "13-internal-newsletter",
    instruction: "change this to the canteen in building A",
    why: "Blocks 4 and 6 also mention the new production hall as the hall that opened; only the venue of the works meeting in block 41 changes.",
    highlight: { blockContaining: "Please note the following", text: "the new production hall" },
    changes: [
      {
        blockContaining: "Please note the following",
        becomesOneOf: [
          "Please note the following dates in your calendar: the works meeting takes place on [DATE_5] in the canteen in building A, the second blood donation of the year is on [DATE_6] in the first aid room of building B, the deadline for submitting ideas for the company suggestion scheme is [DATE_7], and our Christmas party for all colleagues will be held on [DATE_8] in the staff restaurant.",
        ],
      },
    ],
  },
  {
    id: "14-edit",
    document: "14-incident-report",
    instruction: "it was actually 25 delayed customer orders, not 23",
    why: "The summary in block 6 and the customer impact section in block 112 both state the number of late orders.",
    changes: [
      {
        blockContaining: "No data was lost,",
        becomesOneOf: [
          "No data was lost, and there are no indications of a security incident. Customer deliveries were delayed by one to two days for 25 orders; no delivery penalties were incurred.",
        ],
      },
      {
        blockContaining: "The lost output was",
        becomesOneOf: [
          "The lost output was recovered over the following four working days through additional Saturday shifts at both plants. Despite this, 25 customer orders were delivered one to two days late. The sales team informed the affected customers proactively on the day of the outage. The total cost of the outage, including overtime supplements, lost productivity and additional freight, is estimated at EUR 86,000. This figure does not include the working time of the IT staff involved in the response.",
        ],
      },
    ],
  },
  {
    id: "14-everywhere",
    document: "14-incident-report",
    instruction: "replace plant managers with site managers throughout",
    why: "Block 135 has the term twice and block 153 names it as an action owner; 'plant' on its own, as in 'both plants', stays.",
    changes: [
      {
        blockContaining: "Report number INC-2026-0417, prepared",
        becomesOneOf: [
          "Report number INC-2026-0417, prepared by [PERSON_2], Incident Manager, with contributions from [PERSON_1], IT Operations Lead. Status: final, approved by the IT steering committee on [DATE_1]. Distribution: management board, site managers, IT department and works council.",
        ],
      },
      {
        blockContaining: "Incident team set up",
        becomesOneOf: ["Incident team set up in the chat; site managers informed"],
      },
      {
        blockContaining: "Status update to management",
        becomesOneOf: ["Status update to management and site managers"],
      },
      {
        blockContaining: "The incident team worked",
        becomesOneOf: [
          "The incident team worked effectively once it had been set up. Communication with the plants via the site managers and the shift supervisors was described as clear and timely in the feedback from both sites. The decision to switch to manual planning was taken jointly by the incident manager and the site managers at 08:30 and prevented a complete stop of production. The paper-based fallback procedure from the business continuity plan was used for the first time in a real incident and worked largely as intended, although the printed order lists in [LOCATION_2] were not up to date and had to be supplemented by phone.",
        ],
      },
      {
        blockContaining: "Review and update the",
        becomesOneOf: [
          "Review and update the printed fallback order lists at both plants weekly as part of the business continuity plan. Owner: site managers. Due: [DATE_5].",
        ],
      },
    ],
    goneEverywhere: ["plant manager"],
  },
  {
    id: "15-edit",
    document: "15-training-curriculum",
    instruction: "the external trainers now cost EUR 16,000 per run",
    why: "The total per run in block 289 has to follow: 16,000 + 4,950 + 1,600 + 2,700 + 900 = 26,150.",
    changes: [
      { blockContaining: "EUR 14,800", becomesOneOf: ["EUR 16,000"] },
      { blockContaining: "EUR 24,950", becomesOneOf: ["EUR 26,150"] },
    ],
  },
  {
    id: "15-highlight",
    document: "15-training-curriculum",
    instruction: "make this 12 months",
    why: "Blocks 6 and 293 also say six months, for the length of the programme and the follow-up; only the experience requirement changes.",
    highlight: { blockContaining: "At least six months", text: "six months" },
    changes: [
      {
        blockContaining: "At least six months",
        becomesOneOf: [
          "At least 12 months of experience as a team leader, deputy team leader or shift supervisor",
          "At least twelve months of experience as a team leader, deputy team leader or shift supervisor",
        ],
      },
    ],
  },
  {
    id: "16-everywhere",
    document: "16-spare-parts-price-list",
    instruction: "replace wear part kits with maintenance kits throughout",
    why: "The term is in the section heading, the introduction and two discount list items; 'Annual kit' and 'Pneumatics kit' in the kit table stay.",
    changes: [
      {
        blockContaining: "This price list contains",
        becomesOneOf: [
          "This price list contains the most frequently ordered spare parts, maintenance kits and service rates for the edge banding machines of the series EB 300, EB 500 and EB 700. It replaces the price list 2026 and all earlier versions. Parts that are not listed here are available on request; please send us the machine number and the part number from the spare parts catalogue of your machine.",
        ],
      },
      {
        blockContaining: "Compared to the previous",
        becomesOneOf: [
          "Compared to the previous year, prices for most parts have increased by an average of 4.2 percent. The main reasons are higher prices for steel, electronic components and energy. Prices for maintenance kits have remained unchanged, because we were able to bundle our purchasing volumes for these parts.",
        ],
      },
      { blockContaining: "Wear Part Kits", becomesOneOf: ["Maintenance Kits"] },
      {
        blockContaining: "Wear part kits contain",
        becomesOneOf: [
          "Maintenance kits contain all parts that should be replaced during the annual maintenance of the machine. They are cheaper than buying the parts individually and make sure that nothing is forgotten. Each kit comes with a checklist for the replacement.",
        ],
      },
      {
        blockContaining: "The fixed price for",
        becomesOneOf: [
          "The fixed price for the annual maintenance includes up to 8 hours of working time, the travel costs and a written maintenance report. The maintenance kits are invoiced separately at the net price shown above.",
        ],
      },
      {
        blockContaining: "Service contract customers receive",
        becomesOneOf: ["Service contract customers receive 10 percent on all spare parts and maintenance kits."],
      },
      {
        blockContaining: "Machines in the first",
        becomesOneOf: [
          "Machines in the first year after commissioning: maintenance kits are delivered at a 15 percent discount.",
        ],
      },
    ],
    goneEverywhere: ["wear part kit"],
  },
  {
    id: "16-highlight",
    document: "16-spare-parts-price-list",
    instruction: "make this 14 days",
    why: "Block 348 also says 30 days, but that is the payment term and must stay.",
    highlight: { blockContaining: "Returns of unused parts", text: "30 days" },
    changes: [
      {
        blockContaining: "Returns of unused parts",
        becomesOneOf: [
          "Returns of unused parts in their original packaging are accepted within 14 days. We credit 80 percent of the net price; electronic components and parts made to order cannot be returned.",
        ],
      },
    ],
  },
  {
    id: "17-edit",
    document: "17-customer-portal-faq",
    instruction: "service reports are now available in the portal within 48 hours instead of 24",
    why: "Block 57 mentions the 24-hour service hotline, which is a different fact and must stay.",
    changes: [
      {
        blockContaining: "After each service visit,",
        becomesOneOf: [
          "After each service visit, our technician creates a digital service report, which is available in the customer portal under the relevant machine within 48 hours. The report contains the work carried out, the parts used, the measured values and any recommendations for further work.",
        ],
      },
    ],
  },
  {
    id: "17-everywhere",
    document: "17-customer-portal-faq",
    instruction: "replace customer service team with support team throughout",
    why: "The phrase sits in five blocks, one of them a numbered registration step; the many mentions of 'customer portal' are not part of it and stay.",
    changes: [
      {
        blockContaining: "The customer portal of",
        becomesOneOf: [
          "The customer portal of [ORG_1] gives you access to your orders, deliveries, service requests and documents for all compressors and compressed air systems supplied by us, around the clock. This page answers the questions our support team hears most often. If your question is not answered here, please contact us using the details at the end of this page.",
        ],
      },
      {
        blockContaining: "Wait for the activation",
        becomesOneOf: [
          "Wait for the activation of your account. Our support team checks every registration and activates it within one working day.",
        ],
      },
      {
        blockContaining: 'Click on "Forgot password"',
        becomesOneOf: [
          'Click on "Forgot password" on the login page and enter your email address. You will receive an email with a link that is valid for 30 minutes. Follow the link and choose a new password. If you do not receive an email, please check your spam folder. For security reasons, our support team cannot see or reset your password by phone.',
        ],
      },
      {
        blockContaining: "The company administrator can",
        becomesOneOf: [
          'The company administrator can deactivate users at any time under "Company settings" and "Users". Deactivated users can no longer log in, but the orders and service requests they created remain visible to your company. If your company administrator has left, please contact our support team with a written request signed by an authorised representative of your company.',
        ],
      },
      {
        blockContaining: "If you have further",
        becomesOneOf: [
          "If you have further questions or suggestions for improving the customer portal, our support team will be happy to help. You can reach us Monday to Friday from 7:00 a.m. to 6:00 p.m. by phone at [PHONE_2] or by email at [EMAIL_1]. Further help, including short video tutorials, is available in the help centre.",
        ],
      },
    ],
    goneEverywhere: ["customer service"],
  },
  {
    id: "18-edit",
    document: "18-procurement-guideline",
    instruction: "raise the purchasing card limit to EUR 500",
    why: "Blocks 52, 86 and 91 contain EUR 250,000, the limit for legal review and board approval, which must stay.",
    changes: [
      {
        blockContaining: "Small purchases up to",
        becomesOneOf: [
          "Small purchases up to EUR 500 net with a company purchasing card, in line with the purchasing card policy",
        ],
      },
    ],
  },
  {
    id: "18-highlight",
    document: "18-procurement-guideline",
    instruction: "make this EUR 100,000",
    why: "EUR 50,000 also appears in the offer, award, approval and exception rules; only the supplier evaluation threshold may change.",
    highlight: { blockContaining: "Every year in January,", text: "EUR 50,000" },
    changes: [
      {
        blockContaining: "Every year in January,",
        becomesOneOf: [
          "Every year in January, the purchasing department evaluates all suppliers with an annual purchasing volume of more than EUR 100,000 and all suppliers of production material. The evaluation uses the following criteria and weights:",
        ],
      },
    ],
  },
  {
    id: "19-everywhere",
    document: "19-travel-expense-policy",
    instruction: "change trade fair to trade show everywhere",
    why: "Block 56 holds the phrase twice and block 113 is a list item; every mention must change.",
    changes: [
      {
        blockContaining: "The policy applies to",
        becomesOneOf: [
          "The policy applies to all employees, trainees and working students who travel on behalf of [ORG_1] in Germany or abroad. A business trip is any journey that an employee undertakes for work purposes away from their regular place of work and their home, for example customer visits, trade shows, supplier audits, training courses or meetings at another site of the company. Journeys between home and the regular place of work are not business trips and are not reimbursed under this policy.",
        ],
      },
      {
        blockContaining: "Hotels are booked through",
        becomesOneOf: [
          "Hotels are booked through the travel agency portal, which shows hotels with negotiated corporate rates. The following maximum rates per night including breakfast apply: EUR 130 in Germany, EUR 170 in [LOCATION_1] and [LOCATION_2] during trade shows, and the rates listed in the portal for trips abroad. Higher rates must be justified, for example by a trade show or a lack of alternatives near the customer's site. If breakfast is included in the hotel price, the meal allowance is reduced as described in section 6.",
        ],
      },
      {
        blockContaining: "Other necessary costs, such",
        becomesOneOf: [
          "Other necessary costs, such as visa fees, vaccinations required for the trip and trade show entrance tickets",
        ],
      },
    ],
    goneEverywhere: ["trade fair"],
  },
  {
    id: "19-highlight",
    document: "19-travel-expense-policy",
    instruction: "make this three working days",
    why: "Block 12 also says five working days, the lead time for a travel request, and must stay.",
    highlight: { blockContaining: "Submit the report. Your", text: "five working days" },
    changes: [
      {
        blockContaining: "Submit the report. Your",
        becomesOneOf: [
          "Submit the report. Your manager checks it within three working days, and Finance carries out a final review.",
        ],
      },
    ],
  },
  {
    id: "20-edit",
    document: "20-customer-case-study",
    instruction: "the component count is wrong, it was 50 not 46, and the first phase still covered 12",
    why: "Block 36 splits the components into 12 in the first phase and 34 in the second, so the second-phase figure must become 38.",
    changes: [
      {
        blockContaining: "Solution: vibration and temperature",
        becomesOneOf: [
          "Solution: vibration and temperature sensors on 50 critical components, combined with cloud-based analytics and alerts",
        ],
      },
      {
        blockContaining: "Together with the maintenance",
        becomesOneOf: [
          "Together with the maintenance team, [ORG_1] first carried out a criticality analysis of the moulding line and the sand preparation plant. The team identified 50 components whose failure would lead to a stoppage of the line and for which condition monitoring was technically and economically worthwhile. The solution comprises:",
        ],
      },
      {
        blockContaining: "The project was implemented",
        becomesOneOf: [
          "The project was implemented in three phases. In the first four weeks, sensors were installed on the 12 most critical components and the models were trained with the data collected. In the second phase, the remaining 38 components were added during two planned weekend shutdowns, so that no additional downtime was required for the installation. In the third phase, the alert thresholds were fine-tuned together with the maintenance team, and the technicians were trained to interpret the analyses.",
        ],
      },
    ],
  },
  {
    id: "20-everywhere",
    document: "20-customer-case-study",
    instruction: "replace moulding line with production line throughout",
    why: "The phrase appears in a list item and a table cell; 'sand moulds' and 'mould transport system' are not part of it and stay.",
    changes: [
      {
        blockContaining: "How [ORG_2] reduced unplanned",
        becomesOneOf: [
          "How [ORG_2] reduced unplanned downtime in its production line by more than half with the condition monitoring solution of [ORG_1].",
        ],
      },
      {
        blockContaining: "Challenge: frequent unplanned downtime",
        becomesOneOf: [
          "Challenge: frequent unplanned downtime of the automatic production line and high maintenance costs",
        ],
      },
      {
        blockContaining: "[ORG_2] has been producing",
        becomesOneOf: [
          "[ORG_2] has been producing grey and ductile iron castings for more than 90 years. The heart of the foundry is an automatic production line that produces up to 220 sand moulds per hour in three shifts. When the line stops, the entire foundry stops with it: the melting furnaces have to be throttled, the casting crews wait, and delivery dates for customers come under pressure.",
        ],
      },
      {
        blockContaining: "In 2024, the moulding",
        becomesOneOf: [
          "In 2024, the production line recorded 312 hours of unplanned downtime. Most of the stoppages were caused by bearing damage in the sand conveyors, worn hydraulic pumps and overheated gearboxes in the mould transport system. The maintenance team, consisting of 14 technicians, mainly reacted to failures and replaced components at fixed intervals, often long before the end of their actual service life.",
        ],
      },
      {
        blockContaining: "Together with the maintenance",
        becomesOneOf: [
          "Together with the maintenance team, [ORG_1] first carried out a criticality analysis of the production line and the sand preparation plant. The team identified 46 components whose failure would lead to a stoppage of the line and for which condition monitoring was technically and economically worthwhile. The solution comprises:",
        ],
      },
      { blockContaining: "Unplanned downtime of the", becomesOneOf: ["Unplanned downtime of the production line"] },
    ],
    goneEverywhere: ["moulding line"],
  },
  {
    id: "S11",
    document: "sample-offer-with-draft-note",
    instruction: "remove the draft note at the top",
    why: "Edit operations can't delete a block, so a removed paragraph stays as an empty one.",
    changes: [{ blockContaining: "Draft for internal review", becomesOneOf: [""] }],
  },
  {
    id: "S13",
    document: "sample-offer-without-headings",
    instruction: "the workshop is now for 15 people",
    why: "The document has no headings, so the outline is empty and the model has to search.",
    changes: [
      {
        blockContaining: "The customer wants a",
        becomesOneOf: [
          "The customer wants a workshop for 15 people.",
          "The customer now wants a workshop for 15 people.",
        ],
      },
    ],
  },
  {
    id: "S3",
    document: "sample-offer",
    instruction: "change customer to client everywhere",
    why: "'Customer service' in block 7 is the name of a department at the client, so it may become 'client service' or stay; the client itself must be renamed in blocks 4 and 6.",
    changes: [
      {
        blockContaining: "We sat down with",
        becomesOneOf: ["We sat down with the client and noticed there is still a lot to do, especially around AI."],
      },
      { blockContaining: "The customer wants a", becomesOneOf: ["The client wants a workshop for 12 people."] },
      {
        blockContaining: "Participants come from management,",
        becomesOneOf: [
          "Participants come from management, HR, IT and client service. [PERSON_2] coordinates the dates on the side of [ORG_1].",
          "Participants come from management, HR, IT and customer service. [PERSON_2] coordinates the dates on the side of [ORG_1].",
        ],
      },
    ],
    goneEverywhere: ["the customer"],
  },
  {
    id: "S4",
    document: "sample-offer",
    instruction: "the workshop is now for 15 people",
    changes: [
      {
        blockContaining: "The customer wants a",
        becomesOneOf: [
          "The customer wants a workshop for 15 people.",
          "The customer now wants a workshop for 15 people.",
        ],
      },
    ],
  },
  {
    id: "S5",
    document: "sample-offer",
    instruction: "raise the workshop price to EUR 4,000",
    why: "The total in the same table has to follow: 450 + 4,000 + 1,200 = 5,650.",
    changes: [
      { blockContaining: "EUR 3,600", becomesOneOf: ["EUR 4,000"] },
      { blockContaining: "EUR 5,250", becomesOneOf: ["EUR 5,650"] },
    ],
  },
  {
    id: "S6",
    document: "sample-offer",
    instruction: "add that this offer is valid for 30 days next to who it's prepared for",
    changes: [
      {
        blockContaining: "Prepared for [ORG_1], attention",
        newTextIncludes: ["Prepared for [ORG_1], attention of [PERSON_1], by [ORG_2]", "30 days"],
      },
    ],
  },
  {
    id: "S10",
    document: "sample-offer",
    instruction: "make this 15",
    why: "Known gap 15: with a highlight, only the highlighted text may change.",
    highlight: { blockContaining: "The customer wants a", text: "12 people" },
    changes: [
      { blockContaining: "The customer wants a", becomesOneOf: ["The customer wants a workshop for 15 people."] },
    ],
  },
]
