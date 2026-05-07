import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedLayout } from './layouts/ProtectedLayout'
import { CompiledRecordsPage } from './pages/CompiledRecordsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DepartmentTasksPage } from './pages/DepartmentTasksPage'
import { HrRequestViewPage } from './pages/HrRequestViewPage'
import { HrRequestsPage } from './pages/HrRequestsPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { ConventionsInfoPage } from './pages/knowledge/ConventionsInfoPage'
import { IndicatorsInfoPage } from './pages/knowledge/IndicatorsInfoPage'
import { SdgsInfoPage } from './pages/knowledge/SdgsInfoPage'
import { UprInfoPage } from './pages/knowledge/UprInfoPage'
import { LoginPage } from './pages/LoginPage'
import { ManageDepartmentsPage } from './pages/ManageDepartmentsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RegionalResponsesPage } from './pages/RegionalResponsesPage'
import { ReportGeneratorPage } from './pages/ReportGeneratorPage'
import { SuperAdminConsolePage } from './pages/SuperAdminConsolePage'
import { UserManagementPage } from './pages/UserManagementPage'
import { ViolationEntriesPage } from './pages/ViolationEntriesPage'
import { DepartmentMonitoringPage } from './pages/workflow/DepartmentMonitoringPage'
import { FederalCompilationPage } from './pages/workflow/FederalCompilationPage'
import { ReceivedRequestsPage } from './pages/workflow/ReceivedRequestsPage'
import { RequestDistributionPage } from './pages/workflow/RequestDistributionPage'
import { ResponseCompilationPage } from './pages/workflow/ResponseCompilationPage'
import { SubmissionHistoryPage } from './pages/workflow/SubmissionHistoryPage'

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
              <Route path="requests/:id" element={<HrRequestViewPage />} />
              <Route path="requests" element={<HrRequestsPage />} />
              <Route path="responses" element={<RegionalResponsesPage />} />
              <Route path="compilation" element={<FederalCompilationPage />} />
              <Route path="compiled-records" element={<CompiledRecordsPage />} />
              <Route path="federal-users-mgmt" element={<UserManagementPage />} />
              <Route path="federal-departments-mgmt" element={<ManageDepartmentsPage />} />
              <Route
                path="federal-department-requests"
                element={
                  <ReceivedRequestsPage
                    title="Federal — departmental requests"
                    distributionPath="/federal-department-responses"
                    monitoringPath="/federal-department-responses"
                    historyPath="/federal-history"
                    enableRequestCrud
                  />
                }
              />
              <Route path="federal-distribution" element={<Navigate to="/federal-department-requests" replace />} />
              <Route
                path="federal-department-responses"
                element={<DepartmentMonitoringPage title="Federal — departmental responses" />}
              />
              <Route path="federal-received" element={<Navigate to="/federal-department-requests" replace />} />
              <Route path="federal-monitoring" element={<Navigate to="/federal-department-responses" replace />} />
              <Route path="federal-compilation" element={<FederalCompilationPage />} />
              <Route
                path="federal-history"
                element={<SubmissionHistoryPage title="Federal — internal history" />}
              />
              <Route
                path="region-received"
                element={
                  <ReceivedRequestsPage
                    title="Regional — received requests"
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
                    title="Regional — request distribution"
                    nextPath="/region-monitoring"
                  />
                }
              />
              <Route
                path="region-monitoring"
                element={<DepartmentMonitoringPage title="Distributed requests" />}
              />
              <Route
                path="region-compilation"
                element={
                  <ResponseCompilationPage
                    title="Regional — response compilation"
                    nextPath="/region-history"
                  />
                }
              />
              <Route path="regional-users-mgmt" element={<UserManagementPage />} />
              <Route
                path="region-history"
                element={<SubmissionHistoryPage title="Regional — compiled and submitted" />}
              />
              <Route path="department-tasks" element={<DepartmentTasksPage />} />
              <Route path="regional-departments-mgmt" element={<ManageDepartmentsPage />} />
              <Route
                path="department-history"
                element={<SubmissionHistoryPage title="Department — submission history" />}
              />
              <Route path="report-generator" element={<ReportGeneratorPage />} />
              <Route path="analysis" element={<AnalysisPage />} />
              <Route path="conventions" element={<ConventionsInfoPage />} />
              <Route path="indicators" element={<IndicatorsInfoPage />} />
              <Route path="sdgs" element={<SdgsInfoPage />} />
              <Route path="upr" element={<UprInfoPage />} />
              <Route path="violation-entries" element={<ViolationEntriesPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="admin" element={<Navigate to="/admin/regions-districts" replace />} />
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
