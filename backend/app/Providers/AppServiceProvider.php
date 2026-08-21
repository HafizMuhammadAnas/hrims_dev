<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Sanctum only runs StartSession on /api when the request Origin/Referer matches
        // config('sanctum.stateful'). Merge APP_URL / FRONTEND_URL hosts so production
        // cannot miss SANCTUM_STATEFUL_DOMAINS (avoids "Session store not set on request").
        $stateful = config('sanctum.stateful', []);
        if (! is_array($stateful)) {
            $stateful = [];
        }
        foreach ([config('app.url'), config('app.frontend_url')] as $url) {
            if (! is_string($url) || $url === '') {
                continue;
            }
            $host = parse_url($url, PHP_URL_HOST);
            if (! is_string($host) || $host === '') {
                continue;
            }
            $port = parse_url($url, PHP_URL_PORT);
            $entries = [$host];
            if (is_int($port)) {
                $entries[] = $host.':'.$port;
            }
            foreach ($entries as $entry) {
                if (! in_array($entry, $stateful, true)) {
                    $stateful[] = $entry;
                }
            }
        }
        if (! $this->app->runningInConsole()) {
            $requestHost = request()->getHttpHost();
            if (is_string($requestHost) && $requestHost !== '' && ! in_array($requestHost, $stateful, true)) {
                $stateful[] = $requestHost;
            }
        }
        config(['sanctum.stateful' => $stateful]);
    }
}
