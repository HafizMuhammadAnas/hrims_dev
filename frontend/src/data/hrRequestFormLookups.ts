/** Aligned with hrims_old/constants.ts (conventions, recommendations, SDG titles, UPR cycles). */

export const CONVENTIONS: { title: string; fullName: string }[] = [
  {
    title: 'ICERD',
    fullName: 'International Convention on the Elimination of All Forms of Racial Discrimination',
  },
  {
    title: 'ICCPR',
    fullName: 'International Covenant on Civil and Political Rights',
  },
  {
    title: 'ICESCR',
    fullName: 'International Covenant on Economic, Social and Cultural Rights',
  },
  { title: 'CEDAW', fullName: 'Convention on the Elimination of All Forms of Discrimination against Women' },
  { title: 'CAT', fullName: 'Convention against Torture and Other Cruel Treatment' },
  { title: 'CRC', fullName: 'Convention on the Rights of the Child' },
  { title: 'CRPD', fullName: 'Convention on the Rights of Persons with Disabilities' },
]

export const CONVENTION_RECOMMENDATIONS: Record<string, { id: string; label: string }[]> = {
  ICERD: [
    { id: 'icerd-r1', label: 'Periodic report under Article 9' },
    { id: 'icerd-r2', label: 'Legislative alignment with ICERD' },
    { id: 'icerd-r3', label: 'National action plan on racial equality' },
  ],
  ICCPR: [
    { id: 'iccpr-r1', label: 'Civil and political rights — periodic review' },
    { id: 'iccpr-r2', label: 'Administration of justice and fair trial' },
    { id: 'iccpr-r3', label: 'Freedom of expression and assembly' },
  ],
  ICESCR: [
    { id: 'icescr-r1', label: 'Economic, social and cultural rights — core indicators' },
    { id: 'icescr-r2', label: 'Right to health and education data' },
    { id: 'icescr-r3', label: 'Labor rights and social protection' },
  ],
  CEDAW: [
    { id: 'cedaw-r1', label: 'Gender-responsive legislation review' },
    { id: 'cedaw-r2', label: 'Violence against women — prevention and response' },
    { id: 'cedaw-r3', label: 'Women in public life and employment' },
  ],
  CAT: [
    { id: 'cat-r1', label: 'Torture prevention — custody and detention' },
    { id: 'cat-r2', label: 'Training of law enforcement' },
    { id: 'cat-r3', label: 'Complaints and redress mechanisms' },
  ],
  CRC: [
    { id: 'crc-r1', label: 'Child rights — cross-sector data collection' },
    { id: 'crc-r2', label: 'Child protection and education' },
    { id: 'crc-r3', label: 'Juvenile justice' },
  ],
  CRPD: [
    { id: 'crpd-r1', label: 'Accessibility and reasonable accommodation' },
    { id: 'crpd-r2', label: 'Inclusive education and employment' },
    { id: 'crpd-r3', label: 'Independent monitoring frameworks' },
  ],
}

export const SDG_TITLES: string[] = [
  'No poverty',
  'Zero hunger',
  'Good health and well-being',
  'Quality education',
  'Gender equality',
  'Clean water and sanitation',
  'Affordable and clean energy',
  'Decent work and economic growth',
  'Industry, innovation and infrastructure',
  'Reduce inequality',
  'Sustainable cities and communities',
  'Responsible consumption and production',
  'Climate action',
  'Life below water',
  'Life on land',
  'Peace, justice and strong institutions',
  'Partnership for the goals',
]

export const UPR_REQUEST_CYCLES: { title: string }[] = [
  { title: 'Cycle -1' },
  { title: 'Cycle - 2' },
  { title: 'Cycle - 3' },
]

export const HR_REQUEST_STATUSES = ['pending', 'in-progress', 'completed', 'overdue'] as const
