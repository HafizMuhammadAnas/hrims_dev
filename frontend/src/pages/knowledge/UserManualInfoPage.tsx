import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import {
  KnowledgeHubListSection,
  KnowledgeHubPage,
  KnowledgeHubTabs,
} from '../../components/knowledge/KnowledgeHubUi'
import { isFederalStaff, isRegionalAdmin, isSuperAdmin } from '../../lib/roles'
import { LABEL_HRIMS_USER_MANUAL } from '../../lib/uiLabels'

const MANUAL_TABS = ['Federal Manual', 'Regional Manual'] as const
type ManualTab = (typeof MANUAL_TABS)[number]

const MANUAL_SRC: Record<ManualTab, string> = {
  'Federal Manual': '/knowledge/manuals/federal/index.html',
  'Regional Manual': '/knowledge/manuals/regional/index.html',
}

export function UserManualInfoPage() {
  const { user } = useAuth()

  const availableTabs = useMemo((): ManualTab[] => {
    if (!user) return []
    if (isSuperAdmin(user) || isFederalStaff(user)) return ['Federal Manual']
    if (isRegionalAdmin(user)) return ['Regional Manual']
    // Department / other regional workspace users get the regional guide.
    return ['Regional Manual']
  }, [user])

  const [activeTab, setActiveTab] = useState<ManualTab>(() => availableTabs[0] ?? 'Federal Manual')
  const tab = availableTabs.includes(activeTab) ? activeTab : (availableTabs[0] ?? 'Federal Manual')

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title={LABEL_HRIMS_USER_MANUAL}>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Official HRIMS user guide for your workspace.
        </p>

        {availableTabs.length > 1 ? (
          <KnowledgeHubTabs
            tabs={[...availableTabs]}
            activeTab={tab}
            onTabChange={(next) => setActiveTab(next as ManualTab)}
          />
        ) : null}

        {availableTabs.length > 0 ? (
          <section className="hrims-user-manual" aria-label={tab}>
            <iframe
              key={tab}
              className="hrims-user-manual__frame"
              title={tab}
              src={MANUAL_SRC[tab]}
              loading="lazy"
            />
          </section>
        ) : (
          <p className="muted">No user manual is available for this account.</p>
        )}
      </KnowledgeHubListSection>
    </KnowledgeHubPage>
  )
}
