<?php

/**
 * Place this file at: ~/www/<your-subdomain>/public_html/index.php
 *
 * Expected folder layout (siblings):
 *   public_html/           ← web root (this file, .htaccess, dist assets)
 *   hrims_dev/
 *     backend/             ← Laravel app root (composer.json lives here)
 *
 * If your backend lives elsewhere, adjust BACKEND_RELATIVE below.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$backend = dirname(__DIR__) . '/hrims_dev/backend';

// Maintenance mode
if (file_exists($maintenance = $backend . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backend . '/vendor/autoload.php';

/** @var Application $app */
$app = require_once $backend . '/bootstrap/app.php';

$app->handleRequest(Request::capture());
