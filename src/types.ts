// Configure a single trusted operator; this is not per-caller authentication.
export const USER_ID = process.env.SOS_USER_ID;
if (!USER_ID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(USER_ID)) {
  throw new Error("Set SOS_USER_ID to the UUID of your test database user.");
}

// Change Management
export interface ChangeProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  risk_level: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface GlobalStakeholder {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  department: string | null;
  user_id: string;
  created_at: string;
}

export interface ProjectStakeholder {
  id: string;
  project_id: string;
  stakeholder_id: string;
  type: string | null;
  influence_level: string | null;
  engagement: string | null;
  awareness: number | null;
  desire: number | null;
  knowledge: number | null;
  ability: number | null;
  reinforcement: number | null;
  notes: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  global_stakeholders?: GlobalStakeholder;
}

export interface StakeholderGroup {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  date: string;
  type: string;
  description: string | null;
  user_id: string;
}

export interface ScoreHistory {
  id: string;
  stakeholder_id: string;
  dimension: string;
  score: number;
  note: string | null;
  created_at: string;
}

// Tick PM
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string | null;
  board_id: string;
  user_id: string;
}

// OKR
export interface OkrTeam {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
}

export interface Objective {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  quarter: string | null;
  status: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string | null;
  status: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  key_result_id: string;
  value: number;
  note: string | null;
  user_id: string;
  created_at: string;
}

// Vault
export interface Folder {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  user_id: string;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  content: string | null;
  folder_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}
