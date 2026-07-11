<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 10), 200));
        $user = $request->user();

        $rows = Notification::query()
            ->where('user_id', $user->id)
            ->latest()
            ->limit($limit)
            ->get();

        $unreadCount = Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => $rows->map(fn (Notification $notification) => $this->serialize($notification)),
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markRead(Request $request, int $notification): JsonResponse
    {
        $model = Notification::query()
            ->where('user_id', $request->user()->id)
            ->find($notification);

        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($model->read_at === null) {
            $model->forceFill(['read_at' => now()])->save();
        }

        return response()->json(['data' => $this->serialize($model)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        Notification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Notification $notification): array
    {
        return [
            'id' => $notification->id,
            'event_key' => $notification->event_key,
            'title' => $notification->title,
            'message' => $notification->message,
            'entity_type' => $notification->entity_type,
            'entity_id' => $notification->entity_id,
            'route' => $notification->route,
            'meta' => $notification->meta ?? [],
            'read_at' => $notification->read_at?->toISOString(),
            'created_at' => $notification->created_at?->toISOString(),
        ];
    }
}
