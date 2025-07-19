<?php

namespace App\EventListener;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use Symfony\Component\Security\Core\Exception\AuthenticationException;

class ApiExceptionListener
{
    public function onKernelException(ExceptionEvent $event): void
    {
        $request = $event->getRequest();
        
        // Zpracovat pouze API požadavky
        if (!str_starts_with($request->getPathInfo(), '/api/')) {
            return;
        }

        $exception = $event->getThrowable();
        
        // Připravit error response
        $response = new JsonResponse();
        
        // Určit status code a message
        if ($exception instanceof HttpExceptionInterface) {
            $statusCode = $exception->getStatusCode();
            $message = $exception->getMessage();
        } elseif ($exception instanceof AuthenticationException) {
            $statusCode = 401;
            $message = 'Authentication required';
        } elseif ($exception instanceof AccessDeniedException) {
            $statusCode = 403;
            $message = 'Access denied';
        } else {
            $statusCode = 500;
            $message = 'Internal server error';
        }

        // Nastavit response data
        $responseData = [
            'error' => true,
            'message' => $message,
            'code' => $statusCode
        ];

        // V dev prostředí přidat debug info
        if ($_ENV['APP_ENV'] === 'dev') {
            $responseData['debug'] = [
                'exception' => get_class($exception),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString()
            ];
        }

        $response->setData($responseData);
        $response->setStatusCode($statusCode);
        
        // Nastavit response
        $event->setResponse($response);
    }
}