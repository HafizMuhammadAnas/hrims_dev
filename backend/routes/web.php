<?php

use Illuminate\Support\Facades\Route;

/**
 * Resolve the built SPA entry (Vite dist) for SiteGround-style layouts or standard public/.
 */
$spaIndexPath = static function (): string {
    $candidates = [
        dirname(base_path(), 2).DIRECTORY_SEPARATOR.'public_html'.DIRECTORY_SEPARATOR.'index.html',
        public_path('index.html'),
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            return $path;
        }
    }

    return '';
};

Route::get('favicon.ico', function () {
    if (is_file(public_path('favicon.ico'))) {
        return response()->file(public_path('favicon.ico'));
    }
    $publicHtmlIco = dirname(base_path(), 2).DIRECTORY_SEPARATOR.'public_html'.DIRECTORY_SEPARATOR.'favicon.ico';
    if (is_file($publicHtmlIco)) {
        return response()->file($publicHtmlIco);
    }

    return redirect('/favicon.svg', 302);
});

Route::get('/', function () use ($spaIndexPath) {
    $path = $spaIndexPath();
    if ($path !== '') {
        return response()->file($path);
    }

    return view('welcome');
});

Route::fallback(function () use ($spaIndexPath) {
    if (! in_array(request()->method(), ['GET', 'HEAD'], true)) {
        abort(404);
    }
    if (request()->is('api/*')) {
        abort(404);
    }

    $path = $spaIndexPath();
    if ($path === '') {
        abort(404);
    }

    return response()->file($path);
});
