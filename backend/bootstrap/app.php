<?php

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->alias([
            'super.admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Avoid exposing SQL / connection details to API clients (still logged).
        $exceptions->render(function (QueryException $e, Request $request) {
            if ($request->is('api/*')) {
                report($e);

                return response()->json([
                    'message' => 'A database error occurred. Please try again or contact support.',
                    ...(config('app.debug') ? [
                        'debug' => $e->getMessage(),
                    ] : []),
                ], 500);
            }
        });

        // Temporary: turn APP_DEBUG=true on the server to see the real error for login failures.
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (! config('app.debug') || ! $request->is('api/v1/auth/login') || $request->method() !== 'POST') {
                return null;
            }
            report($e);

            return response()->json([
                'message' => $e->getMessage(),
                'exception' => $e::class,
            ], 500);
        });
    })->create();
