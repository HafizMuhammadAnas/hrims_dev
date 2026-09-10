/**
 * Static HTML trackers served from `frontend/public/knowledge/trackers/`.
 * CAT uses the React CatTrackerTab; other conventions with an entry here get
 * an iframe tab labelled "{CODE} Tracker".
 */
export const CONVENTION_HTML_TRACKERS: Record<string, string> = {
  CEDAW: '/knowledge/trackers/cedaw-tracker.html',
  CRPD: '/knowledge/trackers/crpd-tracker.html',
  ICCPR: '/knowledge/trackers/iccpr-tracker.html',
  ICERD: '/knowledge/trackers/icerd-tracker.html',
  ICESCR: '/knowledge/trackers/icescr-tracker.html',
}

export function normalizeConventionCode(code: string): string {
  return code.trim().toUpperCase()
}

export function conventionTrackerTabLabel(code: string): string {
  return `${normalizeConventionCode(code)} Tracker`
}

export function isCatConventionCode(code: string): boolean {
  return normalizeConventionCode(code) === 'CAT'
}

export function conventionHtmlTrackerSrc(code: string): string | null {
  return CONVENTION_HTML_TRACKERS[normalizeConventionCode(code)] ?? null
}

export function hasConventionTracker(code: string): boolean {
  return isCatConventionCode(code) || conventionHtmlTrackerSrc(code) != null
}
