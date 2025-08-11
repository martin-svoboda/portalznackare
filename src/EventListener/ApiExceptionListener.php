<?php

namespace App\EventListener;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\InsufficientAuthenticationException;
use Psr\Log\LoggerInterface;

class ApiExceptionListener
{
    public function __construct(
        private ?LoggerInterface $logger = null
    ) {}

    public function onKernelException(ExceptionEvent $event): void
    {
        $request = $event->getRequest();
        $exception = $event->getThrowable();
        
        $path = $request->getPathInfo();
        $isApiRequest = str_starts_with($path, '/api/');
        $isAdminRequest = str_starts_with($path, '/admin/');
        
        // Zpracuj API endpointy a admin stránky
        if (!$isApiRequest && !$isAdminRequest) {
            return;
        }

        // Log chybu pro debugging
        if ($this->logger) {
            $this->logger->error('Exception caught', [
                'exception' => get_class($exception),
                'message' => $exception->getMessage(),
                'path' => $request->getPathInfo(),
                'method' => $request->getMethod()
            ]);
        }

        $response = null;
        
        // Pro admin stránky vytvoř HTML error stránku
        if ($isAdminRequest && 
            ($exception instanceof InsufficientAuthenticationException || 
             $exception instanceof AccessDeniedException ||
             ($exception instanceof HttpException && in_array($exception->getStatusCode(), [401, 403])))) {
            
            $htmlContent = $this->createAdminErrorPage();
            $response = new Response($htmlContent, 401);
            $response->headers->set('Content-Type', 'text/html; charset=UTF-8');
        
        // Pro API endpointy vytvoř JSON responses
        } elseif ($isApiRequest) {
            if ($exception instanceof NotFoundHttpException) {
                $response = new JsonResponse([
                    'error' => true,
                    'message' => 'API endpoint not found',
                    'code' => 404,
                    'details' => 'The requested API endpoint does not exist.',
                    'path' => $request->getPathInfo(),
                    'method' => $request->getMethod()
                ], Response::HTTP_NOT_FOUND);
                
            } elseif ($exception instanceof InsufficientAuthenticationException 
                || ($exception instanceof HttpException && $exception->getStatusCode() === 401)) {
                $response = new JsonResponse([
                    'error' => true,
                    'message' => 'Authentication required',
                    'code' => 401,
                    'details' => 'You must be logged in to access this resource.'
                ], Response::HTTP_UNAUTHORIZED);
                
            } elseif ($exception instanceof AccessDeniedException 
                      || ($exception instanceof HttpException && $exception->getStatusCode() === 403)) {
                $response = new JsonResponse([
                    'error' => true,
                    'message' => 'Access denied',
                    'code' => 403,
                    'details' => 'You do not have sufficient permissions to access this resource.'
                ], Response::HTTP_FORBIDDEN);
                
            } elseif ($exception instanceof HttpExceptionInterface) {
                $statusCode = $exception->getStatusCode();
                $message = $exception->getMessage() ?: 'HTTP Error';
                
                // Specifické zprávy pro běžné status kódy
                $details = match($statusCode) {
                    400 => 'Bad request - the request could not be understood by the server.',
                    404 => 'The requested API endpoint does not exist.',
                    405 => 'HTTP method not allowed for this endpoint.',
                    429 => 'Too many requests - please try again later.',
                    500 => 'Internal server error occurred.',
                    503 => 'Service temporarily unavailable.',
                    default => 'An HTTP error occurred.'
                };
                
                $response = new JsonResponse([
                    'error' => true,
                    'message' => $message,
                    'code' => $statusCode,
                    'details' => $details,
                    'path' => $request->getPathInfo(),
                    'method' => $request->getMethod()
                ], $statusCode);
                
            } elseif ($exception instanceof AuthenticationException) {
                $response = new JsonResponse([
                    'error' => true,
                    'message' => 'Authentication failed',
                    'code' => 401,
                    'details' => $exception->getMessage()
                ], Response::HTTP_UNAUTHORIZED);
            }
        }

        // Fallback pro ostatní chyby API
        if ($isApiRequest && !$response) {
            $data = [
                'error' => true,
                'message' => $exception->getMessage() ?: 'Internal Server Error',
                'code' => 500,
                'details' => 'An unexpected error occurred on the server.',
                'path' => $request->getPathInfo(),
                'method' => $request->getMethod()
            ];
            
            // V dev módu přidat více informací
            if ($_ENV['APP_ENV'] === 'dev' || $_SERVER['APP_ENV'] === 'dev') {
                $data['debug'] = [
                    'exception' => get_class($exception),
                    'file' => $exception->getFile(),
                    'line' => $exception->getLine(),
                    'trace' => array_slice(explode("\n", $exception->getTraceAsString()), 0, 10)
                ];
            }
            
            $response = new JsonResponse($data, Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        if ($response) {
            // Pro API endpointy nastav JSON headers
            if ($isApiRequest) {
                $response->headers->set('Content-Type', 'application/json; charset=utf-8');
                $response->headers->set('X-Requested-With', 'XMLHttpRequest');
                
                // CORS hlavičky pro API chyby
                $response->headers->set('Access-Control-Allow-Origin', '*');
                $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            }
            
            $event->setResponse($response);
        }
    }
    
    private function createAdminErrorPage(): string
    {
        return '<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <title>Přístup zamítnut - Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .icon { width: 64px; height: 64px; margin: 0 auto 24px; background: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .icon svg { width: 32px; height: 32px; fill: white; }
        h1 { color: #1f2937; margin-bottom: 16px; }
        p { color: #6b7280; margin-bottom: 32px; line-height: 1.5; }
        .btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; }
        .btn:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>
        </div>
        <h1>Přístup zamítnut</h1>
        <p>Pro přístup k administrátorské části se musíte přihlásit s platnými oprávněními.</p>
        <a href="/" class="btn">Přejít na hlavní stránku</a>
    </div>
</body>
</html>';
    }
}