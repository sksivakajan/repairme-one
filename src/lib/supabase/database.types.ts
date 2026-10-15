// GENERATED from migrated PostgreSQL catalog by scripts/generate-db-types.mjs. Do not edit.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = { public: { Tables: {
  accounts: {
    Row: {
      id: string;
      code: string;
      name: string;
      kind: string;
      active: boolean;
    };
    Insert: {
      id?: string;
      code: string;
      name: string;
      kind: string;
      active?: boolean;
    };
    Update: {
      id?: string;
      code?: string;
      name?: string;
      kind?: string;
      active?: boolean;
    };
    Relationships: [];
  };
  active_sessions: {
    Row: {
      user_id: string;
      session_id: string;
      mfa_trusted: boolean;
      started_at: string;
    };
    Insert: {
      user_id: string;
      session_id: string;
      mfa_trusted?: boolean;
      started_at?: string;
    };
    Update: {
      user_id?: string;
      session_id?: string;
      mfa_trusted?: boolean;
      started_at?: string;
    };
    Relationships: [];
  };
  agent_devices: {
    Row: {
      id: string;
      user_id: string;
      token_hash: string;
      device_name: string;
      os: string;
      agent_version: string;
      paired_at: string;
      last_seen_at: string | null;
      revoked_at: string | null;
    };
    Insert: {
      id?: string;
      user_id: string;
      token_hash: string;
      device_name: string;
      os?: string;
      agent_version?: string;
      paired_at?: string;
      last_seen_at?: string | null;
      revoked_at?: string | null;
    };
    Update: {
      id?: string;
      user_id?: string;
      token_hash?: string;
      device_name?: string;
      os?: string;
      agent_version?: string;
      paired_at?: string;
      last_seen_at?: string | null;
      revoked_at?: string | null;
    };
    Relationships: [];
  };
  agent_minutes: {
    Row: {
      user_id: string;
      minute: string;
      seconds: number;
      device_id: string | null;
      source: string;
    };
    Insert: {
      user_id: string;
      minute: string;
      seconds: number;
      device_id?: string | null;
      source?: string;
    };
    Update: {
      user_id?: string;
      minute?: string;
      seconds?: number;
      device_id?: string | null;
      source?: string;
    };
    Relationships: [];
  };
  agent_pairings: {
    Row: {
      id: string;
      user_id: string;
      code_hash: string;
      expires_at: string;
      used_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      code_hash: string;
      expires_at: string;
      used_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      code_hash?: string;
      expires_at?: string;
      used_at?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  agent_status: {
    Row: {
      device_id: string;
      user_id: string;
      state: string;
      cpu_percent: number;
      ram_percent: number;
      ram_used_mb: number;
      ram_total_mb: number;
      cpu_count: number;
      process_count: number;
      foreground_app: string;
      input_idle_seconds: number;
      top_apps: Json;
      updated_at: string;
    };
    Insert: {
      device_id: string;
      user_id: string;
      state: string;
      cpu_percent?: number;
      ram_percent?: number;
      ram_used_mb?: number;
      ram_total_mb?: number;
      cpu_count?: number;
      process_count?: number;
      foreground_app?: string;
      input_idle_seconds?: number;
      top_apps?: Json;
      updated_at?: string;
    };
    Update: {
      device_id?: string;
      user_id?: string;
      state?: string;
      cpu_percent?: number;
      ram_percent?: number;
      ram_used_mb?: number;
      ram_total_mb?: number;
      cpu_count?: number;
      process_count?: number;
      foreground_app?: string;
      input_idle_seconds?: number;
      top_apps?: Json;
      updated_at?: string;
    };
    Relationships: [];
  };
  attendance: {
    Row: {
      id: string;
      employee_id: string;
      day: string;
      check_in: string;
      check_out: string | null;
      status: string;
      active_seconds: number;
      last_seen_at: string | null;
      last_device: string | null;
    };
    Insert: {
      id?: string;
      employee_id: string;
      day: string;
      check_in?: string;
      check_out?: string | null;
      status?: string;
      active_seconds?: number;
      last_seen_at?: string | null;
      last_device?: string | null;
    };
    Update: {
      id?: string;
      employee_id?: string;
      day?: string;
      check_in?: string;
      check_out?: string | null;
      status?: string;
      active_seconds?: number;
      last_seen_at?: string | null;
      last_device?: string | null;
    };
    Relationships: [];
  };
  attendance_corrections: {
    Row: {
      id: string;
      attendance_id: string | null;
      employee_id: string | null;
      original_values: Json;
      proposed_values: Json;
      reason: string;
      status: string;
      reviewer_id: string | null;
    };
    Insert: {
      id?: string;
      attendance_id?: string | null;
      employee_id?: string | null;
      original_values: Json;
      proposed_values: Json;
      reason: string;
      status?: string;
      reviewer_id?: string | null;
    };
    Update: {
      id?: string;
      attendance_id?: string | null;
      employee_id?: string | null;
      original_values?: Json;
      proposed_values?: Json;
      reason?: string;
      status?: string;
      reviewer_id?: string | null;
    };
    Relationships: [];
  };
  attendance_devices: {
    Row: {
      attendance_id: string;
      device_id: string;
      device_label: string;
      first_seen_at: string;
      last_seen_at: string;
      active_seconds: number;
    };
    Insert: {
      attendance_id: string;
      device_id: string;
      device_label?: string;
      first_seen_at?: string;
      last_seen_at?: string;
      active_seconds?: number;
    };
    Update: {
      attendance_id?: string;
      device_id?: string;
      device_label?: string;
      first_seen_at?: string;
      last_seen_at?: string;
      active_seconds?: number;
    };
    Relationships: [];
  };
  audit_events: {
    Row: {
      id: string;
      actor_id: string | null;
      event: string;
      entity_id: string | null;
      details: Json;
      created_at: string;
    };
    Insert: {
      id?: string;
      actor_id?: string | null;
      event: string;
      entity_id?: string | null;
      details?: Json;
      created_at?: string;
    };
    Update: {
      id?: string;
      actor_id?: string | null;
      event?: string;
      entity_id?: string | null;
      details?: Json;
      created_at?: string;
    };
    Relationships: [];
  };
  budgets: {
    Row: {
      id: string;
      name: string;
      project_id: string | null;
      category: string;
      amount: number;
      state: string;
      submitted_by: string | null;
      approved_by: string | null;
      version: number;
      approved_version: number | null;
    };
    Insert: {
      id?: string;
      name: string;
      project_id?: string | null;
      category: string;
      amount: number;
      state?: string;
      submitted_by?: string | null;
      approved_by?: string | null;
      version?: number;
      approved_version?: number | null;
    };
    Update: {
      id?: string;
      name?: string;
      project_id?: string | null;
      category?: string;
      amount?: number;
      state?: string;
      submitted_by?: string | null;
      approved_by?: string | null;
      version?: number;
      approved_version?: number | null;
    };
    Relationships: [];
  };
  candidates: {
    Row: {
      id: string;
      name: string;
      email: string;
      position: string;
      stage: string;
      job_related_evidence: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      email: string;
      position: string;
      stage?: string;
      job_related_evidence?: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      email?: string;
      position?: string;
      stage?: string;
      job_related_evidence?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  checklist_items: {
    Row: {
      id: string;
      employee_id: string | null;
      title: string;
      kind: string;
      completed_at: string | null;
      due_date: string | null;
    };
    Insert: {
      id?: string;
      employee_id?: string | null;
      title: string;
      kind?: string;
      completed_at?: string | null;
      due_date?: string | null;
    };
    Update: {
      id?: string;
      employee_id?: string | null;
      title?: string;
      kind?: string;
      completed_at?: string | null;
      due_date?: string | null;
    };
    Relationships: [];
  };
  company_settings: {
    Row: {
      id: boolean;
      name: string;
      timezone: string;
      currency: string;
      work_start: string;
      work_end: string;
      working_weekdays: number[];
      break_minutes: number | null;
      break_paid: boolean | null;
      leave_policy: Json;
      version: number;
    };
    Insert: {
      id?: boolean;
      name?: string;
      timezone?: string;
      currency?: string;
      work_start?: string;
      work_end?: string;
      working_weekdays?: number[];
      break_minutes?: number | null;
      break_paid?: boolean | null;
      leave_policy?: Json;
      version?: number;
    };
    Update: {
      id?: boolean;
      name?: string;
      timezone?: string;
      currency?: string;
      work_start?: string;
      work_end?: string;
      working_weekdays?: number[];
      break_minutes?: number | null;
      break_paid?: boolean | null;
      leave_policy?: Json;
      version?: number;
    };
    Relationships: [];
  };
  compensation_proposals: {
    Row: {
      id: string;
      employee_id: string | null;
      submitted_by: string;
      current_values: Json;
      proposed_values: Json;
      justification: string;
      state: string;
      hr_reviewer_id: string | null;
      ceo_id: string | null;
      effective_date: string | null;
      version: number;
    };
    Insert: {
      id?: string;
      employee_id?: string | null;
      submitted_by: string;
      current_values: Json;
      proposed_values: Json;
      justification: string;
      state?: string;
      hr_reviewer_id?: string | null;
      ceo_id?: string | null;
      effective_date?: string | null;
      version?: number;
    };
    Update: {
      id?: string;
      employee_id?: string | null;
      submitted_by?: string;
      current_values?: Json;
      proposed_values?: Json;
      justification?: string;
      state?: string;
      hr_reviewer_id?: string | null;
      ceo_id?: string | null;
      effective_date?: string | null;
      version?: number;
    };
    Relationships: [];
  };
  documents: {
    Row: {
      id: string;
      owner_id: string;
      project_id: string | null;
      name: string;
      path: string;
      classification: string;
      mime_type: string;
      size_bytes: number;
      created_at: string;
      state: string;
    };
    Insert: {
      id?: string;
      owner_id: string;
      project_id?: string | null;
      name: string;
      path: string;
      classification: string;
      mime_type: string;
      size_bytes: number;
      created_at?: string;
      state?: string;
    };
    Update: {
      id?: string;
      owner_id?: string;
      project_id?: string | null;
      name?: string;
      path?: string;
      classification?: string;
      mime_type?: string;
      size_bytes?: number;
      created_at?: string;
      state?: string;
    };
    Relationships: [];
  };
  employee_private: {
    Row: {
      employee_id: string;
      contact: Json;
      emergency_contact: Json;
    };
    Insert: {
      employee_id: string;
      contact?: Json;
      emergency_contact?: Json;
    };
    Update: {
      employee_id?: string;
      contact?: Json;
      emergency_contact?: Json;
    };
    Relationships: [];
  };
  employees: {
    Row: {
      id: string;
      employee_number: string;
      first_name: string;
      last_name: string;
      work_email: string;
      department: string;
      job_title: string;
      manager_id: string | null;
      employment_type: string;
      joining_date: string;
      status: string;
      skills: string[];
      version: number;
      created_at: string;
    };
    Insert: {
      id: string;
      employee_number: string;
      first_name: string;
      last_name: string;
      work_email: string;
      department?: string;
      job_title?: string;
      manager_id?: string | null;
      employment_type?: string;
      joining_date?: string;
      status?: string;
      skills?: string[];
      version?: number;
      created_at?: string;
    };
    Update: {
      id?: string;
      employee_number?: string;
      first_name?: string;
      last_name?: string;
      work_email?: string;
      department?: string;
      job_title?: string;
      manager_id?: string | null;
      employment_type?: string;
      joining_date?: string;
      status?: string;
      skills?: string[];
      version?: number;
      created_at?: string;
    };
    Relationships: [];
  };
  expenses: {
    Row: {
      id: string;
      submitted_by: string;
      payee: string;
      purpose: string;
      category: string;
      project_id: string | null;
      amount: number;
      currency: string;
      approved_amount: number | null;
      approval_status: string;
      execution_status: string;
      evidence: string;
      approved_by: string | null;
      approved_version: number | null;
      due_date: string | null;
      version: number;
      created_at: string;
    };
    Insert: {
      id?: string;
      submitted_by: string;
      payee: string;
      purpose: string;
      category: string;
      project_id?: string | null;
      amount: number;
      currency?: string;
      approved_amount?: number | null;
      approval_status?: string;
      execution_status?: string;
      evidence: string;
      approved_by?: string | null;
      approved_version?: number | null;
      due_date?: string | null;
      version?: number;
      created_at?: string;
    };
    Update: {
      id?: string;
      submitted_by?: string;
      payee?: string;
      purpose?: string;
      category?: string;
      project_id?: string | null;
      amount?: number;
      currency?: string;
      approved_amount?: number | null;
      approval_status?: string;
      execution_status?: string;
      evidence?: string;
      approved_by?: string | null;
      approved_version?: number | null;
      due_date?: string | null;
      version?: number;
      created_at?: string;
    };
    Relationships: [];
  };
  finance_approvals: {
    Row: {
      id: string;
      expense_id: string;
      version: number;
      reviewer_id: string;
      decision: string;
      reason: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      expense_id: string;
      version: number;
      reviewer_id: string;
      decision: string;
      reason: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      expense_id?: string;
      version?: number;
      reviewer_id?: string;
      decision?: string;
      reason?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  fiscal_periods: {
    Row: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      locked: boolean;
    };
    Insert: {
      id?: string;
      name: string;
      start_date: string;
      end_date: string;
      locked?: boolean;
    };
    Update: {
      id?: string;
      name?: string;
      start_date?: string;
      end_date?: string;
      locked?: boolean;
    };
    Relationships: [];
  };
  holidays: {
    Row: {
      id: string;
      day: string;
      name: string;
    };
    Insert: {
      id?: string;
      day: string;
      name: string;
    };
    Update: {
      id?: string;
      day?: string;
      name?: string;
    };
    Relationships: [];
  };
  income: {
    Row: {
      id: string;
      source: string;
      invoice_id: string | null;
      category: string;
      amount: number;
      currency: string;
      received_at: string;
      reference: string;
      evidence: string;
      recorded_by: string;
      verified_by: string | null;
      state: string;
      version: number;
      verified_version: number | null;
    };
    Insert: {
      id?: string;
      source: string;
      invoice_id?: string | null;
      category: string;
      amount: number;
      currency?: string;
      received_at: string;
      reference: string;
      evidence: string;
      recorded_by: string;
      verified_by?: string | null;
      state?: string;
      version?: number;
      verified_version?: number | null;
    };
    Update: {
      id?: string;
      source?: string;
      invoice_id?: string | null;
      category?: string;
      amount?: number;
      currency?: string;
      received_at?: string;
      reference?: string;
      evidence?: string;
      recorded_by?: string;
      verified_by?: string | null;
      state?: string;
      version?: number;
      verified_version?: number | null;
    };
    Relationships: [];
  };
  invoices: {
    Row: {
      id: string;
      customer: string;
      amount: number;
      currency: string;
      state: string;
      version: number;
      approved_version: number | null;
      submitted_by: string | null;
      approved_by: string | null;
    };
    Insert: {
      id?: string;
      customer: string;
      amount: number;
      currency?: string;
      state?: string;
      version?: number;
      approved_version?: number | null;
      submitted_by?: string | null;
      approved_by?: string | null;
    };
    Update: {
      id?: string;
      customer?: string;
      amount?: number;
      currency?: string;
      state?: string;
      version?: number;
      approved_version?: number | null;
      submitted_by?: string | null;
      approved_by?: string | null;
    };
    Relationships: [];
  };
  journal_lines: {
    Row: {
      id: string;
      journal_id: string;
      account_id: string;
      debit: number;
      credit: number;
    };
    Insert: {
      id?: string;
      journal_id: string;
      account_id: string;
      debit?: number;
      credit?: number;
    };
    Update: {
      id?: string;
      journal_id?: string;
      account_id?: string;
      debit?: number;
      credit?: number;
    };
    Relationships: [];
  };
  journals: {
    Row: {
      id: string;
      period_id: string;
      entry_date: string;
      description: string;
      source_reference: string;
      submitted_by: string;
      approved_by: string | null;
      version: number;
      approved_version: number | null;
      state: string;
      posted_at: string | null;
      reverses_id: string | null;
    };
    Insert: {
      id?: string;
      period_id: string;
      entry_date: string;
      description: string;
      source_reference: string;
      submitted_by: string;
      approved_by?: string | null;
      version?: number;
      approved_version?: number | null;
      state?: string;
      posted_at?: string | null;
      reverses_id?: string | null;
    };
    Update: {
      id?: string;
      period_id?: string;
      entry_date?: string;
      description?: string;
      source_reference?: string;
      submitted_by?: string;
      approved_by?: string | null;
      version?: number;
      approved_version?: number | null;
      state?: string;
      posted_at?: string | null;
      reverses_id?: string | null;
    };
    Relationships: [];
  };
  leave_ledger: {
    Row: {
      id: string;
      employee_id: string;
      type_id: string;
      request_id: string | null;
      kind: string;
      days: number;
      reason: string;
      period: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      employee_id: string;
      type_id: string;
      request_id?: string | null;
      kind: string;
      days: number;
      reason: string;
      period?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      employee_id?: string;
      type_id?: string;
      request_id?: string | null;
      kind?: string;
      days?: number;
      reason?: string;
      period?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  leave_requests: {
    Row: {
      id: string;
      employee_id: string;
      type_id: string;
      start_date: string;
      end_date: string;
      days: number;
      half_day: boolean;
      reason: string;
      status: string;
      reviewer_id: string | null;
      version: number;
    };
    Insert: {
      id?: string;
      employee_id: string;
      type_id: string;
      start_date: string;
      end_date: string;
      days: number;
      half_day?: boolean;
      reason: string;
      status?: string;
      reviewer_id?: string | null;
      version?: number;
    };
    Update: {
      id?: string;
      employee_id?: string;
      type_id?: string;
      start_date?: string;
      end_date?: string;
      days?: number;
      half_day?: boolean;
      reason?: string;
      status?: string;
      reviewer_id?: string | null;
      version?: number;
    };
    Relationships: [];
  };
  leave_types: {
    Row: {
      id: string;
      name: string;
      policy: Json;
    };
    Insert: {
      id?: string;
      name: string;
      policy?: Json;
    };
    Update: {
      id?: string;
      name?: string;
      policy?: Json;
    };
    Relationships: [];
  };
  notifications: {
    Row: {
      id: string;
      user_id: string;
      title: string;
      href: string;
      dedupe_key: string;
      read_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      title: string;
      href: string;
      dedupe_key: string;
      read_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      title?: string;
      href?: string;
      dedupe_key?: string;
      read_at?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  payments: {
    Row: {
      id: string;
      expense_id: string;
      amount: number;
      reference: string;
      evidence: string;
      recorded_by: string;
      paid_at: string;
    };
    Insert: {
      id?: string;
      expense_id: string;
      amount: number;
      reference: string;
      evidence: string;
      recorded_by: string;
      paid_at?: string;
    };
    Update: {
      id?: string;
      expense_id?: string;
      amount?: number;
      reference?: string;
      evidence?: string;
      recorded_by?: string;
      paid_at?: string;
    };
    Relationships: [];
  };
  payroll_drafts: {
    Row: {
      id: string;
      employee_id: string | null;
      period: string;
      components: Json;
      state: string;
      statutory_verified: boolean;
    };
    Insert: {
      id?: string;
      employee_id?: string | null;
      period: string;
      components: Json;
      state?: string;
      statutory_verified?: boolean;
    };
    Update: {
      id?: string;
      employee_id?: string | null;
      period?: string;
      components?: Json;
      state?: string;
      statutory_verified?: boolean;
    };
    Relationships: [];
  };
  performance_appeals: {
    Row: {
      id: string;
      review_id: string | null;
      employee_id: string | null;
      reason: string;
      state: string;
      reviewer_id: string | null;
      decision: string | null;
    };
    Insert: {
      id?: string;
      review_id?: string | null;
      employee_id?: string | null;
      reason: string;
      state?: string;
      reviewer_id?: string | null;
      decision?: string | null;
    };
    Update: {
      id?: string;
      review_id?: string | null;
      employee_id?: string | null;
      reason?: string;
      state?: string;
      reviewer_id?: string | null;
      decision?: string | null;
    };
    Relationships: [];
  };
  performance_evidence: {
    Row: {
      id: string;
      review_id: string | null;
      task_id: string | null;
      rating: number | null;
      reason: string;
    };
    Insert: {
      id?: string;
      review_id?: string | null;
      task_id?: string | null;
      rating?: number | null;
      reason: string;
    };
    Update: {
      id?: string;
      review_id?: string | null;
      task_id?: string | null;
      rating?: number | null;
      reason?: string;
    };
    Relationships: [];
  };
  performance_periods: {
    Row: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      state: string;
    };
    Insert: {
      id?: string;
      name: string;
      start_date: string;
      end_date: string;
      state?: string;
    };
    Update: {
      id?: string;
      name?: string;
      start_date?: string;
      end_date?: string;
      state?: string;
    };
    Relationships: [];
  };
  performance_reviews: {
    Row: {
      id: string;
      employee_id: string;
      period_id: string;
      reviewer_id: string | null;
      state: string;
      formula_version: string;
      inputs: Json;
      score: number | null;
      reason: string | null;
      employee_response: string | null;
      finalized_at: string | null;
      replaces_id: string | null;
      version: number;
    };
    Insert: {
      id?: string;
      employee_id: string;
      period_id: string;
      reviewer_id?: string | null;
      state?: string;
      formula_version?: string;
      inputs?: Json;
      score?: number | null;
      reason?: string | null;
      employee_response?: string | null;
      finalized_at?: string | null;
      replaces_id?: string | null;
      version?: number;
    };
    Update: {
      id?: string;
      employee_id?: string;
      period_id?: string;
      reviewer_id?: string | null;
      state?: string;
      formula_version?: string;
      inputs?: Json;
      score?: number | null;
      reason?: string | null;
      employee_response?: string | null;
      finalized_at?: string | null;
      replaces_id?: string | null;
      version?: number;
    };
    Relationships: [];
  };
  points_ledger: {
    Row: {
      id: string;
      employee_id: string | null;
      source_id: string;
      points: number;
      approved_by: string;
      reason: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      employee_id?: string | null;
      source_id: string;
      points: number;
      approved_by: string;
      reason: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      employee_id?: string | null;
      source_id?: string;
      points?: number;
      approved_by?: string;
      reason?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  project_members: {
    Row: {
      project_id: string;
      employee_id: string;
    };
    Insert: {
      project_id: string;
      employee_id: string;
    };
    Update: {
      project_id?: string;
      employee_id?: string;
    };
    Relationships: [];
  };
  projects: {
    Row: {
      id: string;
      name: string;
      description: string;
      client: string;
      manager_id: string;
      start_date: string | null;
      due_date: string | null;
      status: string;
      reason: string | null;
      version: number;
      created_at: string;
      deleted_at: string | null;
      deleted_by: string | null;
      delete_reason: string | null;
    };
    Insert: {
      id?: string;
      name: string;
      description?: string;
      client?: string;
      manager_id: string;
      start_date?: string | null;
      due_date?: string | null;
      status?: string;
      reason?: string | null;
      version?: number;
      created_at?: string;
      deleted_at?: string | null;
      deleted_by?: string | null;
      delete_reason?: string | null;
    };
    Update: {
      id?: string;
      name?: string;
      description?: string;
      client?: string;
      manager_id?: string;
      start_date?: string | null;
      due_date?: string | null;
      status?: string;
      reason?: string | null;
      version?: number;
      created_at?: string;
      deleted_at?: string | null;
      deleted_by?: string | null;
      delete_reason?: string | null;
    };
    Relationships: [];
  };
  releases: {
    Row: {
      id: string;
      project_id: string | null;
      name: string;
      state: string;
      checklist: Json;
      deployment_history: Json;
    };
    Insert: {
      id?: string;
      project_id?: string | null;
      name: string;
      state?: string;
      checklist?: Json;
      deployment_history?: Json;
    };
    Update: {
      id?: string;
      project_id?: string | null;
      name?: string;
      state?: string;
      checklist?: Json;
      deployment_history?: Json;
    };
    Relationships: [];
  };
  sprints: {
    Row: {
      id: string;
      project_id: string | null;
      name: string;
      start_date: string | null;
      end_date: string | null;
      state: string;
    };
    Insert: {
      id?: string;
      project_id?: string | null;
      name: string;
      start_date?: string | null;
      end_date?: string | null;
      state?: string;
    };
    Update: {
      id?: string;
      project_id?: string | null;
      name?: string;
      start_date?: string | null;
      end_date?: string | null;
      state?: string;
    };
    Relationships: [];
  };
  support_tickets: {
    Row: {
      id: string;
      ticket_number: number;
      requester_id: string;
      assignee_id: string | null;
      title: string;
      description: string;
      category: string;
      location: string;
      priority: string;
      status: string;
      version: number;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      ticket_number: number;
      requester_id: string;
      assignee_id?: string | null;
      title: string;
      description: string;
      category: string;
      location?: string;
      priority?: string;
      status?: string;
      version?: number;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      ticket_number?: number;
      requester_id?: string;
      assignee_id?: string | null;
      title?: string;
      description?: string;
      category?: string;
      location?: string;
      priority?: string;
      status?: string;
      version?: number;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  task_comments: {
    Row: {
      id: string;
      task_id: string | null;
      author_id: string | null;
      body: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      task_id?: string | null;
      author_id?: string | null;
      body: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      task_id?: string | null;
      author_id?: string | null;
      body?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  task_dependencies: {
    Row: {
      task_id: string;
      depends_on: string;
    };
    Insert: {
      task_id: string;
      depends_on: string;
    };
    Update: {
      task_id?: string;
      depends_on?: string;
    };
    Relationships: [];
  };
  task_developer_details: {
    Row: {
      task_id: string;
      sprint_id: string | null;
      severity: string | null;
      reproduction_steps: string | null;
      repository_url: string | null;
      pull_request_url: string | null;
    };
    Insert: {
      task_id: string;
      sprint_id?: string | null;
      severity?: string | null;
      reproduction_steps?: string | null;
      repository_url?: string | null;
      pull_request_url?: string | null;
    };
    Update: {
      task_id?: string;
      sprint_id?: string | null;
      severity?: string | null;
      reproduction_steps?: string | null;
      repository_url?: string | null;
      pull_request_url?: string | null;
    };
    Relationships: [];
  };
  task_history: {
    Row: {
      id: string;
      task_id: string;
      actor_id: string;
      version: number;
      snapshot: Json;
      reason: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      task_id: string;
      actor_id: string;
      version: number;
      snapshot: Json;
      reason: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      task_id?: string;
      actor_id?: string;
      version?: number;
      snapshot?: Json;
      reason?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  tasks: {
    Row: {
      id: string;
      project_id: string;
      title: string;
      description: string;
      assignee_id: string | null;
      reporter_id: string;
      acceptance_criteria: string;
      priority: string;
      due_date: string | null;
      original_due_date: string | null;
      planned_minutes: number | null;
      weight: number;
      labels: string[] | null;
      status: string;
      evidence: string | null;
      reviewer_id: string | null;
      quality_rating: number | null;
      accepted_at: string | null;
      version: number;
      created_at: string;
      group_id: string | null;
      individual_work: string;
      deleted_at: string | null;
      deleted_by: string | null;
      delete_reason: string | null;
    };
    Insert: {
      id?: string;
      project_id: string;
      title: string;
      description?: string;
      assignee_id?: string | null;
      reporter_id: string;
      acceptance_criteria: string;
      priority?: string;
      due_date?: string | null;
      original_due_date?: string | null;
      planned_minutes?: number | null;
      weight: number;
      labels?: string[] | null;
      status?: string;
      evidence?: string | null;
      reviewer_id?: string | null;
      quality_rating?: number | null;
      accepted_at?: string | null;
      version?: number;
      created_at?: string;
      group_id?: string | null;
      individual_work?: string;
      deleted_at?: string | null;
      deleted_by?: string | null;
      delete_reason?: string | null;
    };
    Update: {
      id?: string;
      project_id?: string;
      title?: string;
      description?: string;
      assignee_id?: string | null;
      reporter_id?: string;
      acceptance_criteria?: string;
      priority?: string;
      due_date?: string | null;
      original_due_date?: string | null;
      planned_minutes?: number | null;
      weight?: number;
      labels?: string[] | null;
      status?: string;
      evidence?: string | null;
      reviewer_id?: string | null;
      quality_rating?: number | null;
      accepted_at?: string | null;
      version?: number;
      created_at?: string;
      group_id?: string | null;
      individual_work?: string;
      deleted_at?: string | null;
      deleted_by?: string | null;
      delete_reason?: string | null;
    };
    Relationships: [];
  };
  ticket_comments: {
    Row: {
      id: string;
      ticket_id: string;
      author_id: string;
      body: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      ticket_id: string;
      author_id: string;
      body: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      ticket_id?: string;
      author_id?: string;
      body?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  ticket_events: {
    Row: {
      id: string;
      ticket_id: string;
      actor_id: string;
      event: string;
      details: Json;
      created_at: string;
    };
    Insert: {
      id?: string;
      ticket_id: string;
      actor_id: string;
      event: string;
      details?: Json;
      created_at?: string;
    };
    Update: {
      id?: string;
      ticket_id?: string;
      actor_id?: string;
      event?: string;
      details?: Json;
      created_at?: string;
    };
    Relationships: [];
  };
  trusted_devices: {
    Row: {
      id: string;
      user_id: string;
      token_hash: string;
      label: string;
      created_at: string;
      expires_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      token_hash: string;
      label?: string;
      created_at?: string;
      expires_at: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      token_hash?: string;
      label?: string;
      created_at?: string;
      expires_at?: string;
    };
    Relationships: [];
  };
  user_roles: {
    Row: {
      user_id: string;
      role: Database['public']['Enums']['app_role'];
    };
    Insert: {
      user_id: string;
      role: Database['public']['Enums']['app_role'];
    };
    Update: {
      user_id?: string;
      role?: Database['public']['Enums']['app_role'];
    };
    Relationships: [];
  };
  work_breaks: {
    Row: {
      id: string;
      user_id: string;
      started_at: string;
      ends_at: string;
      ended_at: string | null;
      end_reason: string | null;
    };
    Insert: {
      id?: string;
      user_id: string;
      started_at?: string;
      ends_at: string;
      ended_at?: string | null;
      end_reason?: string | null;
    };
    Update: {
      id?: string;
      user_id?: string;
      started_at?: string;
      ends_at?: string;
      ended_at?: string | null;
      end_reason?: string | null;
    };
    Relationships: [];
  };
  work_log_reopens: {
    Row: {
      id: string;
      employee_id: string;
      work_date: string;
      opened_by: string;
      reason: string;
      expires_at: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      employee_id: string;
      work_date: string;
      opened_by: string;
      reason: string;
      expires_at: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      employee_id?: string;
      work_date?: string;
      opened_by?: string;
      reason?: string;
      expires_at?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  work_log_comments: {
    Row: {
      id: string;
      work_log_id: string;
      author_id: string;
      body: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      work_log_id: string;
      author_id: string;
      body: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      work_log_id?: string;
      author_id?: string;
      body?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  work_logs: {
    Row: {
      id: string;
      employee_id: string;
      task_id: string;
      start_at: string;
      end_at: string;
      description: string;
      status: string;
      reviewer_id: string | null;
      review_reason: string | null;
      version: number;
      self_quality_rating: number | null;
      work_date: string;
      edited_at: string | null;
      edit_count: number;
    };
    Insert: {
      id?: string;
      employee_id: string;
      task_id: string;
      start_at: string;
      end_at: string;
      description: string;
      status?: string;
      reviewer_id?: string | null;
      review_reason?: string | null;
      version?: number;
      self_quality_rating?: number | null;
      work_date?: string;
      edited_at?: string | null;
      edit_count?: number;
    };
    Update: {
      id?: string;
      employee_id?: string;
      task_id?: string;
      start_at?: string;
      end_at?: string;
      description?: string;
      status?: string;
      reviewer_id?: string | null;
      review_reason?: string | null;
      version?: number;
      self_quality_rating?: number | null;
      work_date?: string;
      edited_at?: string | null;
      edit_count?: number;
    };
    Relationships: [];
  };
  work_streaks: {
    Row: {
      user_id: string;
      streak_seconds: number;
      last_active_at: string | null;
      snoozed_until: string | null;
    };
    Insert: {
      user_id: string;
      streak_seconds?: number;
      last_active_at?: string | null;
      snoozed_until?: string | null;
    };
    Update: {
      user_id?: string;
      streak_seconds?: number;
      last_active_at?: string | null;
      snoozed_until?: string | null;
    };
    Relationships: [];
  };
}; Views: { [_ in never]: never }; Functions: {
provision_employee: { Args: {user_id: string;email: string;first_name: string;last_name: string;employee_number: string;department: string;job_title: string; }; Returns: string };
session_is_current: { Args: Record<PropertyKey, never>; Returns: boolean };
work_log_window: { Args: Record<PropertyKey, never>; Returns: { is_open: boolean; work_day: string; opens: string; closes: string }[] };
mfa_satisfied: { Args: Record<PropertyKey, never>; Returns: boolean };
leader_candidates: { Args: {id: string; }; Returns: { id: string }[] };
prepare_document: { Args: {file_name: string;file_type: string;file_size: number;classification: string;project_id?: string | null; }; Returns: Json };
finish_document: { Args: {document_id: string; }; Returns: undefined };
trust_this_device: { Args: {token_hash: string;device_label?: string | null; }; Returns: undefined };
claim_session: { Args: {trusted_hash?: string | null; }; Returns: undefined };
revoke_trusted_devices: { Args: Record<PropertyKey, never>; Returns: undefined };
work_status: { Args: Record<PropertyKey, never>; Returns: Json };
agent_heartbeat: { Args: {token: string;payload: Json; }; Returns: Json };
agent_pair: { Args: {code: string;device_name: string;os?: string | null;agent_version?: string | null; }; Returns: Json };
command: { Args: {action: string;record_id?: string | null;expected_version?: number | null;payload?: Json | null; }; Returns: Json };
}; Enums: { app_role: 'ceo' | 'admin' | 'hr' | 'finance' | 'manager' | 'employee' }; CompositeTypes: { [_ in never]: never } } };
