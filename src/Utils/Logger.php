<?php

namespace App\Utils;

/**
 * Environment-aware logging utility
 * Logs only when appropriate environment variables are set
 */
class Logger
{
    /**
     * Log debug information (only when DEBUG_PHP is enabled)
     */
    public static function debug(string $message): void
    {
        if (($_ENV['DEBUG_PHP'] ?? 'false') === 'true') {
            error_log($message);
        }
    }
    
    /**
     * Log warning/info information (only when DEBUG_LOG is enabled)
     */
    public static function info(string $message): void
    {
        if (($_ENV['DEBUG_LOG'] ?? 'false') === 'true') {
            error_log($message);
        }
    }
    
    /**
     * Always log errors (production ready)
     */
    public static function error(string $message): void
    {
        error_log($message);
    }
    
    /**
     * Always log critical errors with exception details
     */
    public static function exception(string $context, \Exception $e): void
    {
        error_log("$context - ERROR: " . $e->getMessage());
        
        // Log stack trace only in debug mode
        if (($_ENV['DEBUG_PHP'] ?? 'false') === 'true') {
            error_log("$context - TRACE: " . $e->getTraceAsString());
        }
    }
}