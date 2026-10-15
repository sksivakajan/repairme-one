export type WorkflowField = {
  name: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'textarea';
  options?: string[];
  source?: 'employees' | 'projects' | 'performancePeriods' | 'periods' | 'accounts';
  required?: boolean;
};
export type WorkflowForm = {
  title: string;
  action: string;
  fields: WorkflowField[];
  hint?: string;
};
export const workflowForms: Record<string, WorkflowForm> = {
  'new-review': {
    title: 'Start a monthly review',
    action: 'create_review',
    fields: [
      { name: 'employee_id', label: 'Employee', source: 'employees' },
      { name: 'period_id', label: 'Performance period', source: 'performancePeriods' },
    ],
  },
  'review-evidence': {
    title: 'Review performance evidence',
    action: 'review_evidence',
    fields: [
      { name: 'teamwork_rating', label: 'Evidence-backed teamwork rating (0–5)', type: 'number' },
      { name: 'agreed_weight', label: 'Reviewed eligible workload weight', type: 'number' },
      {
        name: 'workload_adjustment_reason',
        label: 'Leave and blocker adjustment rationale',
        type: 'textarea',
      },
      { name: 'reason', label: 'Evidence-backed reviewer assessment', type: 'textarea' },
    ],
    hint: 'Delivery, quality, and reliability are calculated from eligible task evidence. An approved-leave adjustment must be explained.',
  },
  'review-response': {
    title: 'Respond to your review',
    action: 'review_response',
    fields: [{ name: 'response', label: 'Your response', type: 'textarea' }],
  },
  'finalize-review': {
    title: 'Finalize monthly review',
    action: 'finalize_review',
    fields: [],
    hint: 'Requires complete evidence, an employee response, and the assigned independent reviewer. The finalized record becomes immutable.',
  },
  appeal: {
    title: 'Appeal a finalized review',
    action: 'submit_appeal',
    fields: [{ name: 'reason', label: 'Appeal reason and evidence', type: 'textarea' }],
  },
  'new-budget': {
    title: 'Prepare a budget',
    action: 'prepare_budget',
    fields: [
      { name: 'name', label: 'Budget name' },
      { name: 'category', label: 'Category' },
      { name: 'amount', label: 'Budget amount (LKR)', type: 'number' },
    ],
  },
  'approve-budget': {
    title: 'Approve budget',
    action: 'approve_budget',
    fields: [],
    hint: 'Only an independent CEO can approve the current version.',
  },
  'activate-budget': {
    title: 'Activate approved budget',
    action: 'activate_budget',
    fields: [],
    hint: 'Finance activates the approved version separately.',
  },
  'new-journal': {
    title: 'Prepare a balanced journal',
    action: 'create_journal',
    fields: [
      { name: 'period_id', label: 'Fiscal period', source: 'periods' },
      { name: 'entry_date', label: 'Entry date', type: 'date' },
      { name: 'description', label: 'Description' },
      { name: 'source_reference', label: 'Unique source reference' },
      { name: 'lines', label: 'Journal lines (JSON: account_id, debit, credit)', type: 'textarea' },
    ],
    hint: 'Amounts use exact numeric values. Lines must balance. CEO approval and posting are separate events.',
  },
  'approve-journal': {
    title: 'Approve journal',
    action: 'approve_journal',
    fields: [],
    hint: 'Independent CEO approval applies to the current journal version.',
  },
  'post-journal': {
    title: 'Post approved journal',
    action: 'post_journal',
    fields: [],
    hint: 'Finance may post balanced approved entries only into an unlocked period.',
  },
  'verify-income': {
    title: 'Verify received income',
    action: 'verify_income',
    fields: [],
    hint: 'The money has already been received. CEO verification confirms this record.',
  },
  'new-candidate': {
    title: 'Add a candidate',
    action: 'create_candidate',
    fields: [
      { name: 'name', label: 'Candidate name' },
      { name: 'email', label: 'Email' },
      { name: 'position', label: 'Position' },
      { name: 'job_related_evidence', label: 'Job-related evidence', type: 'textarea' },
    ],
  },
  'candidate-stage': {
    title: 'Update recruitment stage',
    action: 'update_candidate',
    fields: [
      {
        name: 'stage',
        label: 'Stage',
        options: ['screening', 'interview', 'offer', 'hired', 'rejected'],
      },
      { name: 'job_related_evidence', label: 'Job-related decision evidence', type: 'textarea' },
    ],
  },
  'new-sprint': {
    title: 'Plan a sprint',
    action: 'create_sprint',
    fields: [
      { name: 'project_id', label: 'Project', source: 'projects' },
      { name: 'name', label: 'Sprint name' },
      { name: 'start_date', label: 'Start date', type: 'date' },
      { name: 'end_date', label: 'End date', type: 'date' },
    ],
  },
  'new-release': {
    title: 'Prepare a release',
    action: 'create_release',
    fields: [
      { name: 'project_id', label: 'Project', source: 'projects' },
      { name: 'name', label: 'Release name' },
    ],
  },
  'add-member': {
    title: 'Add project member',
    action: 'add_project_member',
    fields: [{ name: 'employee_id', label: 'Employee', source: 'employees' }],
  },
  'account-status': {
    title: 'Change account status',
    action: 'set_account_status',
    fields: [
      {
        name: 'status',
        label: 'Status',
        options: ['onboarding', 'active', 'suspended', 'offboarded'],
      },
    ],
    hint: 'Suspended and offboarded accounts lose database access immediately. The last active owner cannot be disabled.',
  },
  'new-compensation': {
    title: 'Propose role or compensation change',
    action: 'propose_compensation',
    fields: [
      { name: 'employee_id', label: 'Employee', source: 'employees' },
      { name: 'current_values', label: 'Current role / compensation (JSON)', type: 'textarea' },
      { name: 'proposed_values', label: 'Proposed role / compensation (JSON)', type: 'textarea' },
      { name: 'justification', label: 'Business justification and evidence', type: 'textarea' },
    ],
    hint: 'This creates a proposal. HR review, CEO decision, and effective-date recording remain separate.',
  },
  'hr-compensation': {
    title: 'Review compensation proposal',
    action: 'hr_review_compensation',
    fields: [],
    hint: 'An independent HR reviewer must review the proposal.',
  },
  'decide-compensation': {
    title: 'CEO compensation decision',
    action: 'decide_compensation',
    fields: [
      { name: 'decision', label: 'Decision', options: ['approved', 'rejected'] },
      { name: 'effective_date', label: 'Effective date', type: 'date' },
    ],
  },
  'record-compensation': {
    title: 'Record effective change',
    action: 'record_compensation',
    fields: [],
    hint: 'HR records a CEO-approved change on or after its effective date.',
  },
  'leave-cancel': {
    title: 'Request leave cancellation',
    action: 'request_leave_cancellation',
    fields: [],
    hint: 'Your reviewer must approve cancellation before a reversing balance entry is created.',
  },
  'leave-adjust': {
    title: 'Adjust a leave balance',
    action: 'adjust_leave',
    fields: [
      { name: 'employee_id', label: 'Employee', source: 'employees' },
      { name: 'type_id', label: 'Leave type ID' },
      { name: 'days', label: 'Adjustment days (multiples of 0.5)', type: 'number' },
      { name: 'reason', label: 'Adjustment reason', type: 'textarea' },
      { name: 'reference', label: 'Unique adjustment reference' },
    ],
    hint: 'An independent HR administrator records immutable adjustments. Original ledger entries are retained.',
  },
};
