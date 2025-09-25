<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

class ApiAuthenticationEntryPoint implements AuthenticationEntryPointInterface
{
    public function start(Request $request, AuthenticationException $authException = null): Response
    {
        // Pro API požadavky vrať JSON
        if (str_starts_with($request->getPathInfo(), '/api/')) {
            $data = [
                'error' => true,
                'message' => 'Authentication required',
                'code' => 401
            ];

            return new JsonResponse($data, Response::HTTP_UNAUTHORIZED);
        }

        // Pro webové požadavky přesměruj na login stránku s redirect parametrem
        $currentUrl = $request->getRequestUri();

        // Nevracet se zpět na login stránku nebo logout
        if (str_contains($currentUrl, '/prihlaseni') || str_contains($currentUrl, '/logout')) {
            return new RedirectResponse('/prihlaseni');
        }

        // Přesměruj na login s původní URL jako redirect parametrem
        $loginUrl = '/prihlaseni?redirect=' . urlencode($currentUrl);
        return new RedirectResponse($loginUrl);
    }
}