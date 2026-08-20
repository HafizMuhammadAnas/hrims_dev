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

        $forwarded = $request->header('X-Forwarded-Host');
        $host = is_string($forwarded) && $forwarded !== ''
            ? trim(explode(',', $forwarded)[0])
            : $request->getHost();

        $appHost = parse_url((string) config('app.url'), PHP_URL_HOST);
        if (is_string($appHost) && $appHost !== '') {
            $host = $appHost;
        }

        $scheme = parse_url((string) config('app.url'), PHP_URL_SCHEME);
        if (! is_string($scheme) || $scheme === '') {
            $scheme = $request->isSecure() ? 'https' : 'http';
        }

        $request->headers->set('Origin', $scheme.'://'.$host);

        return $next($request);
    }
}
