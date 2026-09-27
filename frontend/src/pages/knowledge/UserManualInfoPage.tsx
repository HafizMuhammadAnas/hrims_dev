import { useState } from 'react'
import {
  KnowledgeHubListSection,
  KnowledgeHubPage,
  KnowledgeHubTabs,
} from '../../components/knowledge/KnowledgeHubUi'
import { LABEL_HRIMS_USER_MANUAL } from '../../lib/uiLabels'

const MANUAL_TABS = ['Federal Manual', 'Regional Manual'] as const
type ManualTab = (typeof MANUAL_TABS)[number]

const MANUAL_SRC: Record<ManualTab, string> = {
  'Federal Manual': '/knowledge/manuals/federal/index.html',
  'Regional Manual': '/knowledge/manuals/regional/index.html',
}

export function UserManualInfoPage() {
  const [activeTab, setActiveTab] = useState<ManualTab>('Federal Manual')

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title={LABEL_HRIMS_USER_MANUAL}>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Official HRIMS user guides for federal and regional (province &amp; department) workspaces.
        </p>

        <KnowledgeHubTabs
          tabs={[...MANUAL_TABS]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ManualTab)}
        />

        <section className="hrims-user-manual" aria-label={activeTab}>
          <iframe
            key={activeTab}
            className="hrims-user-manual__frame"
            title={activeTab}
            src={MANUAL_SRC[activeTab]}
            loading="lazy"
          />
        </section>
      </KnowledgeHubListSection>
    </KnowledgeHubPage>
  )
}
