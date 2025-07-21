<?php

namespace App\EventListener;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ApiExceptionListener
{
    public function onKernelException(ExceptionEvent $event): void
    {
        $request = $event->getRequest();
        
        // Pouze pro API endpointy
        if (!str_starts_with($request->getPathInfo(), '/api/')) {
            return;
        }
        
        $exception = $event->getThrowable();
        
        // Připravit data pro JSON odpověď
        $data = [
            'error' => true,
            'message' => $exception->getMessage()
        ];
        
        // Nastavit status kód
        $statusCode = 500;
        if ($exception instanceof HttpExceptionInterface) {
            $statusCode = $exception->getStatusCode();
        }
        
        // V dev módu přidat více informací
        if ($_ENV['APP_ENV'] === 'dev') {
            $data['exception'] = get_class($exception);
            $data['file'] = $exception->getFile();
            $data['line'] = $exception->getLine();
            $data['trace'] = $exception->getTraceAsString();
        }
        
        // Vytvořit JSON odpověď
        $response = new JsonResponse($data, $statusCode);
        
        // Nastavit odpověď
        $event->setResponse($response);
    }
}