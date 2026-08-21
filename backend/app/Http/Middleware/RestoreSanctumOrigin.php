<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fortinet / WAFs often strip Origin and Referer on GET. Sanctum then skips
 * the session middleware and auth:sanctum returns 401 even though login succeeded.
 */
class RestoreSanctumOrigin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->headers->get('Origin') || $request->headers->get('Referer')) {
            return $next($request);
        }

        $origin = $this->fallbackOrigin($request);
        if ($origin !== null) {
            $request->headers->set('Origin', $origin);
        }

        return $next($request);
    }

    private function fallbackOrigin(Request $request): ?string
    {
        foreach ([config('app.frontend_url'), config('app.url')] as $url) {
            if (! is_string($url) || $url === '') {
                continue;
            }
            $parts = parse_url($url);
            $scheme = $parts['scheme'] ?? ($request->isSecure() ? 'https' : 'http');
            $host = $parts['host'] ?? null;
            if (! is_string($host) || $host === '') {
                continue;
            }
            $port = $parts['port'] ?? null;

            return $port ? "{$scheme}://{$host}:{$port}" : "{$scheme}://{$host}";
        }

        $forwarded = $request->header('X-Forwarded-Host');
        $host = is_string($forwarded) && $forwarded !== ''
            ? trim(explode(',', $forwarded)[0])
            : $request->getHttpHost();

        if ($host === '') {
            return null;
        }

        $scheme = $request->isSecure() ? 'https' : 'http';

        return $scheme.'://'.$host;
    }
}
