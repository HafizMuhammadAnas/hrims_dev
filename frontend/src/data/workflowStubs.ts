import type { WorkflowLink } from '../pages/WorkflowStubPage'

export type WorkflowStubSpec = {
  title: string
  intro: string
  bullets?: string[]
  links?: WorkflowLink[]
}

export const STUB_COMPILATION_CENTER: WorkflowStubSpec = {
  title: 'Compilation center',
  intro:
    'Coordinate national compilation of regional inputs before final submission. Full multi-step UI from hrims_old will be ported here; registers below are already live.',
  bullets: [
    'Review regional responses for each federal cycle.',
    'Track compiled record status and attachments in Compiled records.',
  ],
  links: [
    { to: '/responses', label: 'Review responses' },
    { to: '/compiled-records', label: 'Compiled records' },
    { to: '/requests', label: 'HR requests' },
  ],
}

export const STUB_FEDERAL_USERS: WorkflowStubSpec = {
  title: 'User management (federal)',
  intro:
    'Create and deactivate users, assign federal roles, and reset access. Requires a dedicated users API (planned); contact administrators for changes until then.',
  links: [{ to: '/', label: 'Dashboard' }],
}

export const STUB_FEDERAL_RECEIVED: WorkflowStubSpec = {
  title: 'Federal — active requests',
  intro:
    'Federal view of requests received for in-house distribution (legacy ReceivedRequests). Use the live register meanwhile.',
  links: [{ to: '/requests', label: 'Request management' }],
}

export const STUB_FEDERAL_DISTRIBUTION: WorkflowStubSpec = {
  title: 'Federal — department distribution',
  intro:
    'Assign HR requests to line departments and track acknowledgements. Workflow UI from hrims_old is not yet ported.',
  links: [
    { to: '/requests', label: 'HR requests' },
    { to: '/department-tasks', label: 'Department tasks' },
  ],
}

export const STUB_FEDERAL_MONITORING: WorkflowStubSpec = {
  title: 'Federal — department monitoring',
  intro:
    'Monitor departmental progress and deadlines against federal assignments. Coming in a later sprint with task analytics.',
  links: [{ to: '/department-tasks', label: 'Department tasks' }],
}

export const STUB_FEDERAL_COMPILATION: WorkflowStubSpec = {
  title: 'Response compilation',
  intro: 'Federal-side compilation steps before treaty submission. Related data is under Compilation center and Compiled records.',
  links: [
    { to: '/compilation', label: 'Compilation center' },
    { to: '/compiled-records', label: 'Compiled records' },
  ],
}

export const STUB_FEDERAL_HISTORY: WorkflowStubSpec = {
  title: 'Compiled responses',
  intro:
    'Audit trail of federal actions (legacy SubmissionHistory). Persistent history API is planned; export logs may be added later.',
  links: [{ to: '/requests', label: 'HR requests' }],
}

export const STUB_REGION_RECEIVED: WorkflowStubSpec = {
  title: 'Received Requests',
  intro:
    'Regional inbox for requests routed from federal focal points. Use Request management for your region until the dedicated inbox UI is rebuilt.',
  links: [{ to: '/requests', label: 'Request management' }],
}

export const STUB_REGION_DISTRIBUTION: WorkflowStubSpec = {
  title: 'Regional — request distribution',
  intro: 'Distribute requests to departments within your region. Mirrors legacy RequestDistribution; task APIs exist under Department tasks.',
  links: [
    { to: '/requests', label: 'HR requests' },
    { to: '/department-tasks', label: 'Department tasks' },
  ],
}

export const STUB_REGION_MONITORING: WorkflowStubSpec = {
  title: 'Regional — department monitoring',
  intro: 'Track regional department compliance. Full monitoring dashboard from hrims_old is pending.',
  links: [{ to: '/department-tasks', label: 'Department tasks' }],
}

export const STUB_REGION_COMPILATION: WorkflowStubSpec = {
  title: 'Response compilation',
  intro: 'Compile regional responses before federal review. Start from Review responses and Regional registers.',
  links: [
    { to: '/responses', label: 'Review responses' },
    { to: '/requests', label: 'HR requests' },
  ],
}

export const STUB_REGIONAL_USERS: WorkflowStubSpec = {
  title: 'Regional — user management',
  intro: 'Manage users for your region. Backend user administration endpoints are planned.',
  links: [{ to: '/', label: 'Dashboard' }],
}

export const STUB_REGION_HISTORY: WorkflowStubSpec = {
  title: 'Regional — submission history',
  intro: 'Historical log of regional submissions. Will align with regional response and task timestamps when the history API is available.',
  links: [
    { to: '/responses', label: 'Review responses' },
    { to: '/region-compilation', label: 'Response compilation (stub)' },
  ],
}

export const STUB_DEPARTMENT_HISTORY: WorkflowStubSpec = {
  title: 'Submission history',
  intro: 'Department-level submission log. Use Assigned tasks for current work.',
  links: [{ to: '/department-tasks', label: 'Assigned tasks' }],
}

export const STUB_REPORT_GENERATOR: WorkflowStubSpec = {
  title: 'Report generator',
  intro:
    'Scoped CSV exports and a database-driven report preview live under Reports → Report generator. Figures use the same API data as the rest of the app.',
  bullets: ['Use the sidebar link to open the full report generator.'],
  links: [
    { to: '/report-generator', label: 'Open report generator' },
    { to: '/compiled-records', label: 'Compiled records' },
  ],
}
