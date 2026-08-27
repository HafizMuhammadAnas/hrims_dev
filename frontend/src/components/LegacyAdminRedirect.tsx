import { Navigate, useLocation } from 'react-router-dom'
import { legacyAdminPathToCatalogMgmt } from '../lib/superAdminRoutes'

/** In-app redirect from legacy `/admin/*` links (hard refresh on /admin is still blocked by WAF). */
export function LegacyAdminRedirect() {
  const location = useLocation()
  return <Navigate to={legacyAdminPathToCatalogMgmt(location.pathname, location.search)} replace />
}
