import { useAuth } from '../auth/AuthContext'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'

export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <PageSection title="Profile" subtitle="Signed-in account and access summary.">
      <TableCard className="profile-card">
        <dl className="profile-dl">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Username</dt>
          <dd>{user.username}</dd>
          <dt>Email</dt>
          <dd>{user.email ?? '—'}</dd>
          <dt>Status</dt>
          <dd>{user.is_active ? 'Active' : 'Inactive'}</dd>
          <dt>Region</dt>
          <dd>{user.region ? `${user.region.name} (${user.region.slug})` : '—'}</dd>
          <dt>Department</dt>
          <dd>{user.department ? user.department.name : '—'}</dd>
        </dl>
      </TableCard>

      <h3 className="profile-subhead">Roles &amp; permissions</h3>
      <TableCard>
        {user.roles.length === 0 ? (
          <p className="muted pad-modal">No roles assigned.</p>
        ) : (
          <ul className="profile-role-list">
            {user.roles.map((r) => (
              <li key={r.slug}>
                <strong>{r.name}</strong> <span className="muted">({r.slug})</span>
                {r.permissions.length > 0 && (
                  <ul>
                    {r.permissions.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </TableCard>
    </PageSection>
  )
}
