import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedLayout } from './layouts/ProtectedLayout'
import { CompiledRecordsPage } from './pages/CompiledRecordsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DepartmentTasksPage } from './pages/DepartmentTasksPage'
import { HrRequestEditPage } from './pages/HrRequestEditPage'
import { HrRequestViewPage } from './pages/HrRequestViewPage'
import { FederalRequestManagementPage } from './pages/FederalRequestManagementPage'
import { ConventionsInfoPage } from './pages/knowledge/ConventionsInfoPage'
import { IndicatorsInfoPage } from './pages/knowledge/IndicatorsInfoPage'
import { SdgsInfoPage } from './pages/knowledge/SdgsInfoPage'
import { UprInfoPage } from './pages/knowledge/UprInfoPage'
import { UprRequestsPage } from './pages/UprRequestsPage'
import { LoginPage } from './pages/LoginPage'
import { ManageDepartmentsPage } from './pages/ManageDepartmentsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { CompiledRecordViewPage } from './pages/CompiledRecordViewPage'
import { RegionalCompilationViewPage } from './pages/RegionalCompilationViewPage'
import { RegionalResponseFederalReviewPage } from './pages/RegionalResponseFederalReviewPage'
import { RegionalResponsesPage } from './pages/RegionalResponsesPage'
import { ReportGeneratorPage } from './pages/ReportGeneratorPage'
import { GovernanceDashboardPage } from './pages/GovernanceDashboardPage'
import { GovernanceDefaultChartsAdminPage } from './pages/GovernanceDefaultChartsAdminPage'
import { IndicatorWiseDataAdminPage } from './pages/IndicatorWiseDataAdminPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { IssuesMappingsAdminPage } from './pages/IssuesMappingsAdminPage'
import { RegionsDistrictsAdminPage } from './pages/RegionsDistrictsAdminPage'
import { SuperAdminConsolePage } from './pages/SuperAdminConsolePage'
import { UserManagementPage } from './pages/UserManagementPage'
import { ViolationEntriesPage } from './pages/ViolationEntriesPage'
import { DepartmentMonitoringPage } from './pages/workflow/DepartmentMonitoringPage'
import { FederalCompilationPage } from './pages/workflow/FederalCompilationPage'
import { ReceivedRequestsPage } from './pages/workflow/ReceivedRequestsPage'
import { RequestDistributionPage } from './pages/workflow/RequestDistributionPage'
import { ResponseCompilationPage } from './pages/workflow/ResponseCompilationPage'
import { SubmissionHistoryPage } from './pages/workflow/SubmissionHistoryPage'
import {
  LABEL_COMPILED_AND_SUBMITTED,
  LABEL_COMPILED_RESPONSES,
  LABEL_DEPARTMENTAL_RESPONSES,
  LABEL_RECEIVED_REQUESTS,
  LABEL_REGIONAL_REQUEST_DISTRIBUTION,
  LABEL_RESPONSE_COMPILATION,
  LABEL_SUBMISSION_HISTORY,
} from './lib/uiLabels'

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedLayout />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="requests/:id/edit" element={<HrRequestEditPage />} />
              <Route path="requests/:id" element={<HrRequestViewPage />} />
              <Route path="regional-responses/:responseId" element={<RegionalResponseFederalReviewPage />} />
              <Route path="regional-compilations/:responseId" element={<RegionalCompilationViewPage />} />
              <Route path="compiled-records/:recordId" element={<CompiledRecordViewPage />} />
              <Route path="requests/new" element={<FederalRequestManagementPage />} />
              <Route path="requests/clarifications" element={<FederalRequestManagementPage />} />
              <Route path="requests/regional-responses" element={<FederalRequestManagementPage />} />
              <Route path="requests" element={<FederalRequestManagementPage />} />
              <Route path="federal-upr-requests" element={<UprRequestsPage />} />
              <Route path="responses" element={<RegionalResponsesPage />} />
              <Route path="compilation" element={<FederalCompilationPage />} />
              <Route path="compiled-records" element={<CompiledRecordsPage />} />
              <Route path="federal-users-mgmt/new" element={<UserManagementPage />} />
              <Route path="federal-users-mgmt/:userId/edit" element={<UserManagementPage />} />
              <Route path="federal-users-mgmt" element={<UserManagementPage />} />
              <Route path="federal-departments-mgmt/new" element={<ManageDepartmentsPage />} />
              <Route path="federal-departments-mgmt/:departmentId/edit" element={<ManageDepartmentsPage />} />
              <Route path="federal-departments-mgmt" element={<ManageDepartmentsPage />} />
              <Route
                path="federal-department-requests"
                element={<DepartmentMonitoringPage title={LABEL_DEPARTMENTAL_RESPONSES} />}
              />
              <Route path="federal-distribution" element={<Navigate to="/federal-department-requests" replace />} />
              <Route
                path="federal-department-responses"
                element={<Navigate to="/federal-department-requests" replace />}
              />
              <Route path="federal-received" element={<Navigate to="/federal-department-requests" replace />} />
              <Route path="federal-monitoring" element={<Navigate to="/federal-department-requests" replace />} />
              <Route
                path="federal-compilation"
                element={
                  <ResponseCompilationPage
                    title={LABEL_RESPONSE_COMPILATION}
                    nextPath="/federal-history"
                    scope="ict"
                  />
                }
              />
              <Route
                path="federal-history"
                element={<SubmissionHistoryPage title={LABEL_COMPILED_RESPONSES} />}
              />
              <Route
                path="region-received"
                element={
                  <ReceivedRequestsPage
                    title={LABEL_RECEIVED_REQUESTS}
                    distributionPath="/region-distribution"
                    monitoringPath="/region-monitoring"
                    historyPath="/region-history"
                  />
                }
              />
              <Route
                path="region-distribution"
                element={
                  <RequestDistributionPage
                    title={LABEL_REGIONAL_REQUEST_DISTRIBUTION}
                    nextPath="/region-monitoring"
                  />
                }
              />
              <Route
                path="region-monitoring"
                element={<DepartmentMonitoringPage title={LABEL_DEPARTMENTAL_RESPONSES} />}
              />
              <Route
                path="region-compilation"
                element={
                  <ResponseCompilationPage
                    title={LABEL_RESPONSE_COMPILATION}
                    nextPath="/region-history"
                    scope="regional"
                  />
                }
              />
              <Route path="regional-users-mgmt/new" element={<UserManagementPage />} />
              <Route path="regional-users-mgmt/:userId/edit" element={<UserManagementPage />} />
              <Route path="regional-users-mgmt" element={<UserManagementPage />} />
              <Route
                path="region-history"
                element={<SubmissionHistoryPage title={LABEL_COMPILED_AND_SUBMITTED} />}
              />
              <Route path="department-tasks" element={<DepartmentTasksPage />} />
              <Route path="regional-departments-mgmt/new" element={<ManageDepartmentsPage />} />
              <Route path="regional-departments-mgmt/:departmentId/edit" element={<ManageDepartmentsPage />} />
              <Route path="regional-departments-mgmt" element={<ManageDepartmentsPage />} />
              <Route
                path="department-history"
                element={<SubmissionHistoryPage title={LABEL_SUBMISSION_HISTORY} />}
              />
              <Route path="department-indicator-wise-data" element={<IndicatorWiseDataAdminPage />} />
              <Route path="department-indicator-wise-data/create" element={<IndicatorWiseDataAdminPage />} />
              <Route
                path="department-indicator-wise-data/view/:recordId"
                element={<IndicatorWiseDataAdminPage />}
              />
              <Route path="report-generator" element={<ReportGeneratorPage />} />
              <Route path="governance-dashboard" element={<GovernanceDashboardPage />} />
              <Route path="analysis" element={<Navigate to="/report-generator" replace />} />
              <Route path="conventions" element={<ConventionsInfoPage />} />
              <Route path="indicators" element={<IndicatorsInfoPage />} />
              <Route path="sdgs" element={<SdgsInfoPage />} />
              <Route path="upr" element={<UprInfoPage />} />
              <Route path="violation-entries" element={<ViolationEntriesPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="admin" element={<Navigate to="/admin/issues" replace />} />
              <Route path="admin/issues/edit/:issueId" element={<IssuesMappingsAdminPage />} />
              <Route path="admin/issues/view/:issueId" element={<IssuesMappingsAdminPage />} />
              <Route path="admin/issues/articles/view/:articleId" element={<IssuesMappingsAdminPage />} />
              <Route path="admin/issues" element={<IssuesMappingsAdminPage />} />
              <Route path="admin/issues/:issuesView" element={<IssuesMappingsAdminPage />} />
              <Route path="admin/regions-districts" element={<RegionsDistrictsAdminPage />} />
              <Route path="admin/regions-districts/:geoView" element={<RegionsDistrictsAdminPage />} />
              <Route path="admin/governance-charts" element={<GovernanceDefaultChartsAdminPage />} />
              <Route path="admin/indicator-wise-data" element={<IndicatorWiseDataAdminPage />} />
              <Route path="admin/indicator-wise-data/create" element={<IndicatorWiseDataAdminPage />} />
              <Route path="admin/indicator-wise-data/view/:recordId" element={<IndicatorWiseDataAdminPage />} />
              <Route path="admin/:section" element={<SuperAdminConsolePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
