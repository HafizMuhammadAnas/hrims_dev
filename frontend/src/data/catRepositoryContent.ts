export type CatRepositoryDocument = {
  id: string
  title: string
  fileName: string
  href: string
  typeLabel: string
  icon: string
}

export type CatRepositoryCycle = {
  id: string
  title: string
  documents: CatRepositoryDocument[]
}

const BASE = '/knowledge/cat/repository'

export const CAT_REPOSITORY_CYCLES: CatRepositoryCycle[] = [
  {
    id: 'first-cycle',
    title: 'First cycle',
    documents: [
      {
        id: 'fc-state-report',
        title: 'Pakistan State Report 2016',
        fileName: '1-cat-pakistan-state-report-2016.pdf',
        href: `${BASE}/first-cycle/1-cat-pakistan-state-report-2016.pdf`,
        typeLabel: 'PDF report',
        icon: '📄',
      },
      {
        id: 'fc-concluding-observations',
        title: 'Concluding observations on the initial report of Pakistan (June 2017)',
        fileName: '1a-concluding-observations-initial-report-pakistan-june-2017.pdf',
        href: `${BASE}/first-cycle/1a-concluding-observations-initial-report-pakistan-june-2017.pdf`,
        typeLabel: 'PDF document',
        icon: '📑',
      },
      {
        id: 'fc-followup-reply',
        title: 'Concluding observations — Pakistan follow-up reply (2019)',
        fileName: '1b-concluding-observations-pakistan-followup-reply-2019.docx',
        href: `${BASE}/first-cycle/1b-concluding-observations-pakistan-followup-reply-2019.docx`,
        typeLabel: 'Word document',
        icon: '📝',
      },
    ],
  },
  {
    id: 'second-cycle',
    title: 'Second cycle',
    documents: [
      {
        id: 'sc-periodic-report',
        title: 'Pakistan second periodic report (December 2022)',
        fileName: '2-pakistan-second-periodic-report-dec-2022.pdf',
        href: `${BASE}/second-cycle/2-pakistan-second-periodic-report-dec-2022.pdf`,
        typeLabel: 'PDF report',
        icon: '📄',
      },
      {
        id: 'sc-list-of-issues',
        title: 'List of issues (2025)',
        fileName: '2a-list-of-issues-2025.pdf',
        href: `${BASE}/second-cycle/2a-list-of-issues-2025.pdf`,
        typeLabel: 'PDF document',
        icon: '📋',
      },
      {
        id: 'sc-replies-loi',
        title: 'Replies of Pakistan to the list of issues (2nd periodic report, 2025)',
        fileName: '2b-replies-pakistan-list-of-issues-2nd-periodic-report-2025.pdf',
        href: `${BASE}/second-cycle/2b-replies-pakistan-list-of-issues-2nd-periodic-report-2025.pdf`,
        typeLabel: 'PDF document',
        icon: '📑',
      },
      {
        id: 'sc-concluding-observation',
        title: 'Concluding observation (2026)',
        fileName: '2c-concluding-observation-2026.pdf',
        href: `${BASE}/second-cycle/2c-concluding-observation-2026.pdf`,
        typeLabel: 'PDF document',
        icon: '📑',
      },
    ],
  },
]
