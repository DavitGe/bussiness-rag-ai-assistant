import { ingestText } from "@/lib/ingestion";
import { getVectorStore, upsertDocument } from "./ragState";

declare global {
  // eslint-disable-next-line no-var
  var __ragDefaultsSeeded: boolean | undefined;
}

export async function seedVectorStoreOnce() {
  if (globalThis.__ragDefaultsSeeded) return;
  globalThis.__ragDefaultsSeeded = true;

  const store = getVectorStore();
  const employeeWorkPolicy = `Employee Work Policy 
    
    All full-time employees are expected to work a standard schedule of 40 hours per week. 
Flexible working hours are permitted with prior approval from a direct manager.

Remote work is allowed up to three days per week. Employees requesting fully remote work 
must submit a written request to Human Resources and receive approval from both HR and 
their department manager.

Overtime work must be approved in advance. Any overtime worked without prior approval 
may not be compensated.

Employees are required to follow company security policies when working remotely, 
including the use of company-approved devices and secure VPN connections.
`;

  const expenseReimbursementProcess = `Expense Reimbursement Process

Employees may submit reimbursement requests for business-related expenses.
All requests must be submitted within 30 days of the expense date.

Required documentation includes:
- Original receipts
- Purpose of the expense
- Project or client name

Expenses exceeding $500 require additional approval from the department head.

Reimbursements are processed on a bi-weekly basis and paid through payroll.
`;

  const itSecurityGuidelines = `IT Security Guidelines

All employees must use multi-factor authentication (MFA) for accessing internal systems.

Passwords must:
- Be at least 12 characters long
- Contain uppercase, lowercase, numbers, and symbols
- Be changed every 90 days

Sensitive data must not be stored on personal devices.
Any security incident must be reported to the IT department within 24 hours.
`;

  await ingestText(store, {
    documentName: "Employee_Work_Policy",
    text: employeeWorkPolicy,
    sectionLabel: "Default",
  });
  upsertDocument({ name: "Employee_Work_Policy", text: employeeWorkPolicy });
  await ingestText(store, {
    documentName: "Expense_Reimbursement_Process",
    text: expenseReimbursementProcess,
    sectionLabel: "Default",
  });
  upsertDocument({
    name: "Expense_Reimbursement_Process",
    text: expenseReimbursementProcess,
  });
  await ingestText(store, {
    documentName: "IT_Security_Guidelines",
    text: itSecurityGuidelines,
    sectionLabel: "Default",
  });
  upsertDocument({ name: "IT_Security_Guidelines", text: itSecurityGuidelines });
}