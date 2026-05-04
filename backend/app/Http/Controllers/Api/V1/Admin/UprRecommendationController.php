<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprRecommendation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UprRecommendationController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = UprRecommendation::query()->orderBy('session_label')->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $rows->map(fn (UprRecommendation $u) => $this->serialize($u))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_label' => ['required', 'string', 'max:128'],
            'code' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:500'],
            'body' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $row = UprRecommendation::query()->create($data);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, UprRecommendation $uprRecommendation): JsonResponse
    {
        $data = $request->validate([
            'session_label' => ['sometimes', 'string', 'max:128'],
            'code' => ['sometimes', 'string', 'max:64'],
            'title' => ['sometimes', 'string', 'max:500'],
            'body' => ['sometimes', 'nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
        $uprRecommendation->fill($data);
        $uprRecommendation->save();

        return response()->json(['data' => $this->serialize($uprRecommendation->fresh())]);
    }

    public function destroy(UprRecommendation $uprRecommendation): JsonResponse
    {
        $uprRecommendation->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(UprRecommendation $u): array
    {
        return [
            'id' => $u->id,
            'session_label' => $u->session_label,
            'code' => $u->code,
            'title' => $u->title,
            'body' => $u->body,
            'sort_order' => $u->sort_order,
        ];
    }
}
