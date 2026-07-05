import type { LucideIcon } from 'lucide-react'
import {
  Activity,
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
  LayoutGrid,
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
import { issuesNavLabel, uprConcludingObservationsLabel } from '../lib/issueEntryKind'
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
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" onPick={onPick} />

        {superAdmin && (
          <>
            <div className="nav-section-title">Super admin</div>
            <div className="nav-sub">
              <NavItem to="/admin/issues" icon={GitBranch} label={issuesNavLabel()} onPick={onPick} />
              <NavItem to="/admin/regions-districts" icon={MapPin} label="Regions & districts" onPick={onPick} />
              <NavItem to="/admin/conventions" icon={Scale} label="Conventions & components" onPick={onPick} />
              <NavItem to="/admin/sdg-nodes" icon={Layers} label="SDG nodes" onPick={onPick} />
              <NavItem to="/admin/upr-recommendations" icon={ScrollText} label={uprConcludingObservationsLabel()} onPick={onPick} />
              <NavItem to="/admin/knowledge-hub" icon={LayoutGrid} label="Knowledge hub pages" onPick={onPick} />
              <NavItem to="/federal-users-mgmt" icon={UserCog} label="User management" onPick={onPick} />
              <NavItem to="/report-generator" icon={PieChart} label="Reporting dashboard" onPick={onPick} />
            </div>
          </>
        )}

        {federal && (
          <>
            <div className="nav-section-title">Federal actions</div>
            <div className="nav-sub">
              <NavItem to="/requests" icon={Send} label="Request management" onPick={onPick} />
              <NavItem to="/responses" icon={Inbox} label="Regional responses" onPick={onPick} />
              <NavItem to="/compilation" icon={Layers} label="Compilation center" onPick={onPick} />
              <NavItem to="/compiled-records" icon={FileCheck} label="Compiled records" onPick={onPick} />
              <NavItem to="/federal-users-mgmt" icon={UserCog} label="User management" onPick={onPick} />
              <NavItem to="/federal-departments-mgmt" icon={Building2} label="Manage departments" onPick={onPick} />
            </div>
            <div className="nav-section-title">Federal department actions</div>
            <div className="nav-sub">
              <NavItem to="/federal-department-requests" icon={Activity} label="Departmental responses" onPick={onPick} />
              <NavItem to="/federal-compilation" icon={FileText} label="Response compilation" onPick={onPick} />
              <NavItem to="/federal-history" icon={History} label="Compiled record" onPick={onPick} />
            </div>
            <div className="nav-section-title">Reports</div>
            <NavItem to="/report-generator" icon={PieChart} label="Reporting dashboard" onPick={onPick} />
          </>
        )}

        {regional && (
          <>
            <div className="nav-section-title">Province actions</div>
            <div className="nav-sub">
              <NavItem to="/region-received" icon={List} label="Received requests" onPick={onPick} />
              <NavItem to="/region-monitoring" icon={Activity} label="Departmental responses" onPick={onPick} />
              <NavItem to="/region-compilation" icon={FileText} label="Response compilation" onPick={onPick} />
              <NavItem to="/region-history" icon={History} label="Compiled and submitted" onPick={onPick} />
              <NavItem to="/regional-users-mgmt" icon={Users} label="User management" onPick={onPick} />
              <NavItem to="/regional-departments-mgmt" icon={Building2} label="Manage departments" onPick={onPick} />
            </div>
            <div className="nav-section-title">Reports</div>
            <NavItem to="/report-generator" icon={PieChart} label="Reporting dashboard" onPick={onPick} />
          </>
        )}

        {dept && (
          <>
            <div className="nav-section-title">Department actions</div>
            <div className="nav-sub">
              <NavItem to="/department-tasks" icon={ClipboardList} label="Assigned tasks" onPick={onPick} />
              <NavItem to="/department-history" icon={History} label="Submission history" onPick={onPick} />
            </div>
          </>
        )}

        {viewer && (
          <>
            <div className="nav-section-title">Read-only access</div>
            <div className="nav-sub">
              {user.region?.slug === 'ict' || user.region?.slug === 'federal' ? (
                <NavItem to="/federal-history" icon={History} label="History" onPick={onPick} />
              ) : (
                <NavItem to="/region-history" icon={History} label="History" onPick={onPick} />
              )}
            </div>
          </>
        )}

        <div className="nav-section-title">Knowledge hub</div>
        <NavItem to="/conventions" icon={BookOpen} label="Conventions info" onPick={onPick} />
        <NavItem to="/indicators" icon={Target} label="Human rights indicators" onPick={onPick} />
        <NavItem to="/sdgs" icon={Globe} label="Sustainable development goals" onPick={onPick} />
        <NavItem to="/upr" icon={RefreshCcw} label="Universal periodic review" onPick={onPick} />
      </nav>
    </aside>
  )
}
