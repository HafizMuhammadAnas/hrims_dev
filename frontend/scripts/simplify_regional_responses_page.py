from pathlib import Path
import re

p = Path(r"c:\Users\lenovo\Documents\hrims\website\frontend\src\pages\RegionalResponsesPage.tsx")
t = p.read_text(encoding="utf-8")

# Remove modal block
t = re.sub(
    r"\n      \{viewing && \([\s\S]*?\n      \)\}\n    </>",
    "\n    </>",
    t,
    count=1,
)

replacements = [
    (
        "import { Link, useSearchParams } from 'react-router-dom'",
        "import { Link, useNavigate, useSearchParams } from 'react-router-dom'",
    ),
    (
        "import { fetchHrRequest } from '../api/hrRequests'\n",
        "",
    ),
    (
        "import { updateRegionalReview } from '../api/workflows'\n",
        "",
    ),
    (
        "import { DepartmentSubmissionsForRequest } from '../components/DepartmentSubmissionsForRequest'\n",
        "",
    ),
    (
        "import { HrRequestViewTemplate } from '../components/HrRequestViewTemplate'\n",
        "",
    ),
    (
        "import { ModalActions } from '../components/ui/ModalChrome'\n",
        "",
    ),
    (
        "import { WorkflowModalHero } from '../components/ui/WorkflowModalHero'\n",
        "",
    ),
    (
        "import { useNotify } from '../context/NotificationsContext'\n",
        "",
    ),
    (
        "import { buildFederalOriginalRequestViewTemplateProps } from '../lib/hrRequestForwardedViewTemplateProps'\n",
        "",
    ),
    (
        "import { isFederalAdmin, isSuperAdmin } from '../lib/roles'\n",
        "import { regionalResponseFederalReviewPath } from '../lib/workflowNavigation'\n",
    ),
    (
        "import type { HrRequestRow } from '../types/hrRequest'\n\n",
        "",
    ),
    (
        "type FederalModalTab = 'responses' | 'request'\n\n",
        "",
    ),
    (
        """function sortTasksByDept(a: DepartmentTaskRow, b: DepartmentTaskRow): number {
  const an = (a.department_name ?? a.department_id).toLowerCase()
  const bn = (b.department_name ?? b.department_id).toLowerCase()
  return an.localeCompare(bn)
}

""",
        "",
    ),
    (
        """type Props = {
  /** Render table only (inside Request management tabs). */
  embedded?: boolean
}

export function RegionalResponsesPage({ embedded = false }: Props) {
  const { user } = useAuth()
  const notify = useNotify()
  const federal = isFederalAdmin(user)
  const superUser = isSuperAdmin(user)
  const canReviewFederal = federal || superUser
""",
        """type Props = {
  /** Render table only (inside Request management tabs). */
  embedded?: boolean
  fromPath?: string
}

export function RegionalResponsesPage({ embedded = false, fromPath: fromPathProp }: Props) {
  const navigate = useNavigate()
  const listFromPath = fromPathProp ?? (embedded ? '/requests/regional-responses' : '/responses')
""",
    ),
    (
        """  const [viewing, setViewing] = useState<RegionalResponseRow | null>(null)
  const [modalTab, setModalTab] = useState<FederalModalTab>('responses')
  const [hrDetail, setHrDetail] = useState<HrRequestRow | null>(null)
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState<string | null>(null)
  const [reviewComments, setReviewComments] = useState('')
  const [saving, setSaving] = useState(false)

""",
        "",
    ),
    (
        """  const tasksForViewing = useMemo(() => {
    if (!viewing) return []
    return tasks.filter((t) => t.req_id === viewing.req_id).sort(sortTasksByDept)
  }, [tasks, viewing])

  const allResponsesForRequest = useMemo(() => {
    if (!viewing) return []
    return rows
      .filter((r) => r.req_id === viewing.req_id)
      .sort((a, b) => (a.region_name ?? '').localeCompare(b.region_name ?? '') || a.id.localeCompare(b.id))
  }, [rows, viewing])

""",
        "",
    ),
    (
        """  function openView(row: RegionalResponseRow) {
    setError(null)
    setModalTab('responses')
    setViewing(row)
    setReviewComments(row.comments ?? '')
  }

  useEffect(() => {
    if (!viewing?.req_id) {
      setHrDetail(null)
      setHrError(null)
      setHrLoading(false)
      return
    }
    let cancelled = false
    setHrLoading(true)
    setHrError(null)
    void fetchHrRequest(viewing.req_id)
      .then((r) => {
        if (!cancelled) setHrDetail(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setHrError(e instanceof Error ? e.message : 'Failed to load HR request')
      })
      .finally(() => {
        if (!cancelled) setHrLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewing?.req_id])

  const federalRequestTemplateProps = useMemo(
    () => (hrDetail ? buildFederalOriginalRequestViewTemplateProps(hrDetail) : null),
    [hrDetail],
  )

  async function reloadResponses() {
    const list = await fetchRegionalResponses()
    setRows(list)
  }

  async function persistReview(status: ReviewStatus, comments: string) {
    if (!viewing) return
    const idSaved = viewing.id
    setSaving(true)
    setError(null)
    try {
      const saved = await updateRegionalReview(idSaved, status, comments)
      setRows((prev) => prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)))
      await reloadResponses()
      setViewing(null)
      notify.success(status === 'accepted' ? 'Response accepted.' : 'Review saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  async function acceptResponse() {
    await persistReview('accepted', reviewComments)
  }

  async function requestModification() {
    if (!reviewComments.trim()) {
      setError('Add feedback for the region when requesting modification.')
      return
    }
    await persistReview('needs-modification', reviewComments)
  }

  async function rejectResponse() {
    if (!reviewComments.trim()) {
      setError('Add a short note to the region when rejecting.')
      return
    }
    await persistReview('rejected', reviewComments)
  }

""",
        """  function openView(row: RegionalResponseRow) {
    navigate(regionalResponseFederalReviewPath(row.id, listFromPath))
  }

""",
    ),
]

for old, new in replacements:
    if old not in t:
        print("MISSING:", old[:60].replace("\n", " "))
    else:
        t = t.replace(old, new, 1)

# Remove unused tasks if only used in modal - tasks might still be needed? Actually tasks state is loaded but might not be used in list only page now.
# Check if tasks is used in remaining file
if "tasks" not in t.replace("fetchDepartmentTasks", "").replace("setTasks", "").replace("DepartmentTaskRow", ""):
    pass

p.write_text(t, encoding="utf-8", newline="\n")
print("done")
