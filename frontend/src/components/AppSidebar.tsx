import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart2,
  Building2,
  BookOpen,
  ClipboardList,
  FileCheck,
  FileText,
  GitBranch,
  Globe,
  History,
  Inbox,
  Layers,
  LayoutDashboard,
  List,
  MapPin,
  PieChart,
  RefreshCcw,
  Scale,
  ScrollText,
  Send,
  Target,
  UserCog,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { issuesNavLabel } from '../lib/issueEntryKind'
import {
  LABEL_ASSIGNED_TASKS,
  LABEL_COMPILED_AND_SUBMITTED,
  LABEL_COMPILATION_CENTER,
  LABEL_COMPILED_RECORD,
  LABEL_COMPILED_RECORDS,
  LABEL_CONVENTION_INFO,
  LABEL_CONVENTIONS_AND_COMPONENTS,
  LABEL_DEPARTMENT_ACTIONS,
  LABEL_DEPARTMENTAL_RESPONSES,
  LABEL_FEDERAL_ACTIONS,
  LABEL_FEDERAL_DEPARTMENT_ACTIONS,
  LABEL_HUMAN_RIGHTS_INDICATORS,
  LABEL_KNOWLEDGE_HUB,
  LABEL_MANAGE_DEPARTMENTS,
  LABEL_PROVINCE_ACTIONS,
  LABEL_READ_ONLY_ACCESS,
  LABEL_RECEIVED_REQUESTS,
  LABEL_REGIONAL_RESPONSES,
  LABEL_REGIONS_AND_DISTRICTS,
  LABEL_DASHBOARDS,
  LABEL_GOVERNANCE_DASHBOARD,
  LABEL_GOVERNANCE_DEFAULT_CHARTS,
  LABEL_REPORTING_DASHBOARD,
  LABEL_REQUEST_MANAGEMENT,
  LABEL_RESPONSE_COMPILATION,
  LABEL_SUBMISSION_HISTORY,
  LABEL_SUPER_ADMIN,
  LABEL_SUSTAINABLE_DEVELOPMENT_GOALS,
  LABEL_UNIVERSAL_PERIODIC_REVIEW,
  LABEL_USER_MANAGEMENT,
} from '../lib/uiLabels'
import {
  isDepartmentAdmin,
  isFederalAdmin,
  isRegionalAdmin,
  isSuperAdmin,
  isViewer,
} from '../lib/roles'

function NavItem({
  to,
  icon: Icon,
  label,
  onPick,
}: {
  to: string
  icon: LucideIcon
  label: string
  onPick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onPick}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  autoCloseOnNavigate?: boolean
}

export function AppSidebar({ open, onClose, autoCloseOnNavigate = false }: Props) {
  const { user } = useAuth()
  if (!user) return null

  const viewer = isViewer(user)
  const superAdmin = isSuperAdmin(user)
  const federal = isFederalAdmin(user)
  const regional = isRegionalAdmin(user)
  const dept = isDepartmentAdmin(user)

  const onPick = autoCloseOnNavigate ? onClose : undefined

  return (
    <aside
      className="sidebar-shell"
      style={{
        position: 'fixed',
        top: 80,
        left: open ? 0 : -280,
        zIndex: 900,
        transition: '0.3s',
        height: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }}
    >
      <nav className="nav-menu">
        <NavItem to="/" icon={LayoutDashboard} label="Home" onPick={onPick} />

        {superAdmin && (
          <>
            <div className="nav-section-title">{LABEL_SUPER_ADMIN}</div>
            <div className="nav-sub">
              <NavItem to="/admin/issues" icon={GitBranch} label={issuesNavLabel()} onPick={onPick} />
              <NavItem to="/admin/regions-districts" icon={MapPin} label={LABEL_REGIONS_AND_DISTRICTS} onPick={onPick} />
              <NavItem to="/admin/conventions" icon={Scale} label={LABEL_CONVENTIONS_AND_COMPONENTS} onPick={onPick} />
              <NavItem to="/admin/sdg-nodes" icon={Layers} label="SDGs" onPick={onPick} />
              <NavItem to="/admin/upr-recommendations" icon={ScrollText} label="UPR Recommendations" onPick={onPick} />
              <NavItem to="/admin/governance-charts" icon={BarChart2} label={LABEL_GOVERNANCE_DEFAULT_CHARTS} onPick={onPick} />
              <NavItem to="/federal-users-mgmt" icon={UserCog} label={LABEL_USER_MANAGEMENT} onPick={onPick} />
            </div>
            <div className="nav-section-title">{LABEL_DASHBOARDS}</div>
            <div className="nav-sub">
              <NavItem to="/report-generator" icon={PieChart} label={LABEL_REPORTING_DASHBOARD} onPick={onPick} />
              <NavItem to="/governance-dashboard" icon={LayoutDashboard} label={LABEL_GOVERNANCE_DASHBOARD} onPick={onPick} />
            </div>
          </>
        )}

        {federal && (
          <>
            <div className="nav-section-title">{LABEL_FEDERAL_ACTIONS}</div>
            <div className="nav-sub">
              <NavItem to="/requests" icon={Send} label={LABEL_REQUEST_MANAGEMENT} onPick={onPick} />
              <NavItem to="/responses" icon={Inbox} label={LABEL_REGIONAL_RESPONSES} onPick={onPick} />
              <NavItem to="/compilation" icon={Layers} label={LABEL_COMPILATION_CENTER} onPick={onPick} />
              <NavItem to="/compiled-records" icon={FileCheck} label={LABEL_COMPILED_RECORDS} onPick={onPick} />
              <NavItem to="/federal-users-mgmt" icon={UserCog} label={LABEL_USER_MANAGEMENT} onPick={onPick} />
              <NavItem to="/federal-departments-mgmt" icon={Building2} label={LABEL_MANAGE_DEPARTMENTS} onPick={onPick} />
            </div>
            <div className="nav-section-title">{LABEL_FEDERAL_DEPARTMENT_ACTIONS}</div>
            <div className="nav-sub">
              <NavItem to="/federal-department-requests" icon={Activity} label={LABEL_DEPARTMENTAL_RESPONSES} onPick={onPick} />
              <NavItem to="/federal-compilation" icon={FileText} label={LABEL_RESPONSE_COMPILATION} onPick={onPick} />
              <NavItem to="/federal-history" icon={History} label={LABEL_COMPILED_RECORD} onPick={onPick} />
            </div>
            <div className="nav-section-title">{LABEL_DASHBOARDS}</div>
            <div className="nav-sub">
              <NavItem to="/report-generator" icon={PieChart} label={LABEL_REPORTING_DASHBOARD} onPick={onPick} />
              <NavItem to="/governance-dashboard" icon={LayoutDashboard} label={LABEL_GOVERNANCE_DASHBOARD} onPick={onPick} />
            </div>
          </>
        )}

        {regional && (
          <>
            <div className="nav-section-title">{LABEL_PROVINCE_ACTIONS}</div>
            <div className="nav-sub">
              <NavItem to="/region-received" icon={List} label={LABEL_RECEIVED_REQUESTS} onPick={onPick} />
              <NavItem to="/region-monitoring" icon={Activity} label={LABEL_DEPARTMENTAL_RESPONSES} onPick={onPick} />
              <NavItem to="/region-compilation" icon={FileText} label={LABEL_RESPONSE_COMPILATION} onPick={onPick} />
              <NavItem to="/region-history" icon={History} label={LABEL_COMPILED_AND_SUBMITTED} onPick={onPick} />
              <NavItem to="/regional-users-mgmt" icon={Users} label={LABEL_USER_MANAGEMENT} onPick={onPick} />
              <NavItem to="/regional-departments-mgmt" icon={Building2} label={LABEL_MANAGE_DEPARTMENTS} onPick={onPick} />
            </div>
            <div className="nav-section-title">{LABEL_DASHBOARDS}</div>
            <div className="nav-sub">
              <NavItem to="/report-generator" icon={PieChart} label={LABEL_REPORTING_DASHBOARD} onPick={onPick} />
              <NavItem to="/governance-dashboard" icon={LayoutDashboard} label={LABEL_GOVERNANCE_DASHBOARD} onPick={onPick} />
            </div>
          </>
        )}

        {dept && (
          <>
            <div className="nav-section-title">{LABEL_DEPARTMENT_ACTIONS}</div>
            <div className="nav-sub">
              <NavItem to="/department-tasks" icon={ClipboardList} label={LABEL_ASSIGNED_TASKS} onPick={onPick} />
              <NavItem to="/department-history" icon={History} label={LABEL_SUBMISSION_HISTORY} onPick={onPick} />
            </div>
          </>
        )}

        {viewer && (
          <>
            <div className="nav-section-title">{LABEL_READ_ONLY_ACCESS}</div>
            <div className="nav-sub">
              {user.region?.slug === 'ict' || user.region?.slug === 'federal' ? (
                <NavItem to="/federal-history" icon={History} label="History" onPick={onPick} />
              ) : (
                <NavItem to="/region-history" icon={History} label="History" onPick={onPick} />
              )}
            </div>
          </>
        )}

        <div className="nav-section-title">{LABEL_KNOWLEDGE_HUB}</div>
        <NavItem to="/conventions" icon={BookOpen} label={LABEL_CONVENTION_INFO} onPick={onPick} />
        <NavItem to="/indicators" icon={Target} label={LABEL_HUMAN_RIGHTS_INDICATORS} onPick={onPick} />
        <NavItem to="/sdgs" icon={Globe} label={LABEL_SUSTAINABLE_DEVELOPMENT_GOALS} onPick={onPick} />
        <NavItem to="/upr" icon={RefreshCcw} label={LABEL_UNIVERSAL_PERIODIC_REVIEW} onPick={onPick} />
      </nav>
    </aside>
  )
}
