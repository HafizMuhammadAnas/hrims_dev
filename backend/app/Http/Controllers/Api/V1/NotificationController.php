<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Support\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 10), 200));
        $user = $request->user();
        $service = app(NotificationService::class);

        $rows = $this->scopedQuery($user, $service)
            ->latest()
            ->limit($limit)
            ->get();

        $unreadCount = $this->scopedQuery($user, $service)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => $rows->map(fn (Notification $notification) => $this->serialize($notification, $service)),
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markRead(Request $request, int $notification): JsonResponse
    {
        $service = app(NotificationService::class);
        $model = $this->scopedQuery($request->user(), $service)->find($notification);

        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($model->read_at === null) {
            $model->forceFill(['read_at' => now()])->save();
        }

        return response()->json(['data' => $this->serialize($model, $service)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $service = app(NotificationService::class);
        $this->scopedQuery($request->user(), $service)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read']);
    }

    /**
     * @return Builder<Notification>
     */
    private function scopedQuery($user, NotificationService $service): Builder
    {
        $query = Notification::query()->where('user_id', $user->id);
        $allowed = $service->allowedEventKeysFor($user);
        if ($allowed !== null) {
            $query->whereIn('event_key', $allowed);
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Notification $notification, NotificationService $service): array
    {
        return [
            'id' => $notification->id,
            'event_key' => $notification->event_key,
            'title' => $service->displayTitle($notification),
            'message' => $service->displayMessage($notification),
            'entity_type' => $notification->entity_type,
            'entity_id' => $notification->entity_id,
            'route' => $notification->route,
            'meta' => $notification->meta ?? [],
            'read_at' => $notification->read_at?->toISOString(),
            'created_at' => $notification->created_at?->toISOString(),
        ];
    }
}
