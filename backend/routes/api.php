<?php

use App\Http\Controllers\Api\V1\Admin\ConventionComponentController as AdminConventionComponentController;
use App\Http\Controllers\Api\V1\Admin\ConventionController as AdminConventionController;
use App\Http\Controllers\Api\V1\Admin\DepartmentController as AdminDepartmentController;
use App\Http\Controllers\Api\V1\Admin\DistrictController as AdminDistrictController;
use App\Http\Controllers\Api\V1\Admin\KnowledgeCardController as AdminKnowledgeCardController;
use App\Http\Controllers\Api\V1\Admin\ArticleController as AdminArticleController;
use App\Http\Controllers\Api\V1\Admin\IssueCategoryController as AdminIssueCategoryController;
use App\Http\Controllers\Api\V1\Admin\IssueController as AdminIssueController;
use App\Http\Controllers\Api\V1\Admin\RegionController as AdminRegionController;
use App\Http\Controllers\Api\V1\Admin\SdgNodeController as AdminSdgNodeController;
use App\Http\Controllers\Api\V1\Admin\UprRecommendationController as AdminUprRecommendationController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CompiledRecordController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\DepartmentTaskController;
use App\Http\Controllers\Api\V1\FederalGroupController;
use App\Http\Controllers\Api\V1\HrRequestController;
use App\Http\Controllers\Api\V1\KnowledgeHubController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\RegionalResponseController;
use App\Http\Controllers\Api\V1\RegionController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\ViolationEntryController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', fn () => ['status' => 'ok', 'app' => config('app.name')])->name('api.v1.health');

    // Throttle uses the default cache store; database cache without a `cache` table causes 500 here.
    // Re-add e.g. ->middleware('throttle:5,1') after CACHE_STORE=file (or migrate cache table).
    Route::post('/auth/login', [AuthController::class, 'login'])->name('api.v1.auth.login');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->name('api.v1.auth.reset-password');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
        Route::get('/notifications', [NotificationController::class, 'index'])->name('api.v1.notifications.index');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('api.v1.notifications.read');
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('api.v1.notifications.read-all');

        Route::get('/regions', [RegionController::class, 'index'])->name('api.v1.regions.index');
        Route::get('/departments', [DepartmentController::class, 'index'])->name('api.v1.departments.index');

        Route::get('/knowledge/conventions', [KnowledgeHubController::class, 'conventions'])->name('api.v1.knowledge.conventions.index');
        Route::get('/knowledge/conventions/{convention}', [KnowledgeHubController::class, 'showConvention'])->name('api.v1.knowledge.conventions.show');
        Route::get('/knowledge/sdg-goals', [KnowledgeHubController::class, 'sdgGoals'])->name('api.v1.knowledge.sdg-goals');
        Route::get('/knowledge/indicators', [KnowledgeHubController::class, 'indicators'])->name('api.v1.knowledge.indicators');
        Route::get('/knowledge/upr-highlights', [KnowledgeHubController::class, 'uprHighlights'])->name('api.v1.knowledge.upr-highlights');

        Route::get('/users', [UserController::class, 'index'])->name('api.v1.users.index');
        Route::post('/users', [UserController::class, 'store'])->name('api.v1.users.store');
        Route::patch('/users/{user}', [UserController::class, 'update'])->name('api.v1.users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('api.v1.users.destroy');
        Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->name('api.v1.dashboard.summary');

        Route::get('/federal-groups', [FederalGroupController::class, 'index'])->name('api.v1.federal-groups.index');
        Route::get('/federal-groups/{federalGroup}', [FederalGroupController::class, 'show'])->name('api.v1.federal-groups.show');

        Route::get('/regional-responses', [RegionalResponseController::class, 'index'])->name('api.v1.regional-responses.index');
        Route::post('/regional-responses', [RegionalResponseController::class, 'store'])->name('api.v1.regional-responses.store');
        Route::patch('/regional-responses/{regionalResponse}', [RegionalResponseController::class, 'update'])->name('api.v1.regional-responses.update');
        Route::get('/regional-responses/{regionalResponse}', [RegionalResponseController::class, 'show'])->name('api.v1.regional-responses.show');

        Route::get('/compiled-records/preview', [CompiledRecordController::class, 'preview'])->name('api.v1.compiled-records.preview');
        Route::get('/compiled-records', [CompiledRecordController::class, 'index'])->name('api.v1.compiled-records.index');
        Route::post('/compiled-records', [CompiledRecordController::class, 'store'])->name('api.v1.compiled-records.store');
        Route::get('/department-tasks', [DepartmentTaskController::class, 'index'])->name('api.v1.department-tasks.index');
        Route::post('/department-tasks', [DepartmentTaskController::class, 'store'])->name('api.v1.department-tasks.store');
        Route::patch('/department-tasks/{departmentTask}', [DepartmentTaskController::class, 'updateReview'])->name('api.v1.department-tasks.update-review');
        Route::get('/violation-entries', [ViolationEntryController::class, 'index'])->name('api.v1.violation-entries.index');

        Route::get('/hr-request-form/conventions', [HrRequestController::class, 'formConventions'])->name('api.v1.hr-request-form.conventions');
        Route::get('/hr-request-form/issues', [HrRequestController::class, 'formIssues'])->name('api.v1.hr-request-form.issues');
        Route::get('/hr-request-form/federal-departments', [HrRequestController::class, 'formFederalDepartments'])->name('api.v1.hr-request-form.federal-departments');

        Route::apiResource('hr-requests', HrRequestController::class)->parameters([
            'hr-requests' => 'hrRequest',
        ]);

        Route::middleware('super.admin')->prefix('admin')->group(function (): void {
            Route::post('/regions', [AdminRegionController::class, 'store'])->name('api.v1.admin.regions.store');
            Route::patch('/regions/{region}', [AdminRegionController::class, 'update'])->name('api.v1.admin.regions.update');
            Route::delete('/regions/{region}', [AdminRegionController::class, 'destroy'])->name('api.v1.admin.regions.destroy');

            Route::get('/districts', [AdminDistrictController::class, 'index'])->name('api.v1.admin.districts.index');
            Route::post('/districts', [AdminDistrictController::class, 'store'])->name('api.v1.admin.districts.store');
            Route::patch('/districts/{district}', [AdminDistrictController::class, 'update'])->name('api.v1.admin.districts.update');
            Route::delete('/districts/{district}', [AdminDistrictController::class, 'destroy'])->name('api.v1.admin.districts.destroy');

            Route::get('/catalog/departments', [AdminDepartmentController::class, 'index'])->name('api.v1.admin.catalog.departments.index');
            Route::post('/catalog/departments', [AdminDepartmentController::class, 'store'])->name('api.v1.admin.catalog.departments.store');
            Route::patch('/catalog/departments/{department}', [AdminDepartmentController::class, 'update'])->name('api.v1.admin.catalog.departments.update');
            Route::delete('/catalog/departments/{department}', [AdminDepartmentController::class, 'destroy'])->name('api.v1.admin.catalog.departments.destroy');

            Route::get('/conventions', [AdminConventionController::class, 'index'])->name('api.v1.admin.conventions.index');
            Route::post('/conventions', [AdminConventionController::class, 'store'])->name('api.v1.admin.conventions.store');
            Route::patch('/conventions/{convention}', [AdminConventionController::class, 'update'])->name('api.v1.admin.conventions.update');
            Route::delete('/conventions/{convention}', [AdminConventionController::class, 'destroy'])->name('api.v1.admin.conventions.destroy');

            Route::get('/conventions/{convention}/components', [AdminConventionComponentController::class, 'index'])->name('api.v1.admin.convention-components.index');
            Route::post('/conventions/{convention}/components', [AdminConventionComponentController::class, 'store'])->name('api.v1.admin.convention-components.store');
            Route::patch('/convention-components/{convention_component}', [AdminConventionComponentController::class, 'update'])->name('api.v1.admin.convention-components.update');
            Route::delete('/convention-components/{convention_component}', [AdminConventionComponentController::class, 'destroy'])->name('api.v1.admin.convention-components.destroy');

            Route::get('/sdg-nodes', [AdminSdgNodeController::class, 'index'])->name('api.v1.admin.sdg-nodes.index');
            Route::post('/sdg-nodes', [AdminSdgNodeController::class, 'store'])->name('api.v1.admin.sdg-nodes.store');
            Route::patch('/sdg-nodes/{sdg_node}', [AdminSdgNodeController::class, 'update'])->name('api.v1.admin.sdg-nodes.update');
            Route::delete('/sdg-nodes/{sdg_node}', [AdminSdgNodeController::class, 'destroy'])->name('api.v1.admin.sdg-nodes.destroy');

            Route::get('/upr-recommendations', [AdminUprRecommendationController::class, 'index'])->name('api.v1.admin.upr.index');
            Route::post('/upr-recommendations', [AdminUprRecommendationController::class, 'store'])->name('api.v1.admin.upr.store');
            Route::patch('/upr-recommendations/{upr_recommendation}', [AdminUprRecommendationController::class, 'update'])->name('api.v1.admin.upr.update');
            Route::delete('/upr-recommendations/{upr_recommendation}', [AdminUprRecommendationController::class, 'destroy'])->name('api.v1.admin.upr.destroy');

            Route::get('/knowledge-cards', [AdminKnowledgeCardController::class, 'index'])->name('api.v1.admin.knowledge-cards.index');
            Route::post('/knowledge-cards', [AdminKnowledgeCardController::class, 'store'])->name('api.v1.admin.knowledge-cards.store');
            Route::patch('/knowledge-cards/{knowledge_card}', [AdminKnowledgeCardController::class, 'update'])->name('api.v1.admin.knowledge-cards.update');
            Route::delete('/knowledge-cards/{knowledge_card}', [AdminKnowledgeCardController::class, 'destroy'])->name('api.v1.admin.knowledge-cards.destroy');

            Route::get('/issue-categories', [AdminIssueCategoryController::class, 'index'])->name('api.v1.admin.issue-categories.index');
            Route::post('/issue-categories', [AdminIssueCategoryController::class, 'store'])->name('api.v1.admin.issue-categories.store');
            Route::patch('/issue-categories/{issue_category}', [AdminIssueCategoryController::class, 'update'])->name('api.v1.admin.issue-categories.update');
            Route::delete('/issue-categories/{issue_category}', [AdminIssueCategoryController::class, 'destroy'])->name('api.v1.admin.issue-categories.destroy');

            Route::get('/articles', [AdminArticleController::class, 'index'])->name('api.v1.admin.articles.index');
            Route::post('/articles', [AdminArticleController::class, 'store'])->name('api.v1.admin.articles.store');
            Route::patch('/articles/{article}', [AdminArticleController::class, 'update'])->name('api.v1.admin.articles.update');
            Route::delete('/articles/{article}', [AdminArticleController::class, 'destroy'])->name('api.v1.admin.articles.destroy');

            Route::get('/issues', [AdminIssueController::class, 'index'])->name('api.v1.admin.issues.index');
            Route::post('/issues', [AdminIssueController::class, 'store'])->name('api.v1.admin.issues.store');
            Route::get('/issues/{issue}', [AdminIssueController::class, 'show'])->name('api.v1.admin.issues.show');
            Route::patch('/issues/{issue}', [AdminIssueController::class, 'update'])->name('api.v1.admin.issues.update');
            Route::delete('/issues/{issue}', [AdminIssueController::class, 'destroy'])->name('api.v1.admin.issues.destroy');
        });
    });
});
