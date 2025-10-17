<?php

namespace App\Security;

use App\Service\InsyzService;
use App\Service\AuditLogger;
use App\Service\UserPreferenceService;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\RememberMeBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;

class InsyzAuthenticator extends AbstractAuthenticator
{
    public function __construct(
        private InsyzService $insyzService,
        private InsyzUserProvider $userProvider,
        private AuditLogger $auditLogger,
        private UserRepository $userRepository,
        private UserPreferenceService $userPreferenceService
    ) {}

    public function supports(Request $request): ?bool
    {
        // Podporujeme pouze POST na /api/auth/login pro autentizaci
        // Pro ostatní API endpointy používá Symfony automaticky session storage
        return $request->getPathInfo() === '/api/auth/login' && $request->isMethod('POST');
    }

    public function authenticate(Request $request): Passport
    {
        // Podporuj jak JSON data (pro AJAX), tak form data (pro HTML formuláře)
        if ($request->getContentType() === 'json') {
            $data = json_decode($request->getContent(), true);
            $username = $data['username'] ?? '';
            $password = $data['password'] ?? '';
        } else {
            // Standard HTML form data
            $username = $request->request->get('username', '');
            $password = $request->request->get('password', '');
        }

        if (empty($username) || empty($password)) {
            throw new CustomUserMessageAuthenticationException('Username and password are required');
        }

        try {
            // Ověř přes INSYZ
            $intAdr = $this->insyzService->loginUser($username, $password);
            
            if (!$intAdr) {
                throw new CustomUserMessageAuthenticationException('Invalid credentials');
            }

            // Vytvoř passport s user badge a remember me
            return new SelfValidatingPassport(
                new UserBadge((string)$intAdr, function ($userIdentifier) {
                    return $this->userProvider->loadUserByIdentifier($userIdentifier);
                }),
                [new RememberMeBadge()]
            );
            
        } catch (\Exception $e) {
            throw new CustomUserMessageAuthenticationException('Authentication failed: ' . $e->getMessage());
        }
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        $user = $token->getUser();

        // Update last login and log successful authentication
        if ($user instanceof \App\Entity\User) {
            // ✅ OPRAVA: Update bez okamžitého flush
            $user->setLastLoginAt(new \DateTimeImmutable());
            $this->userRepository->save($user, false); // Bez flush!

            // Zajistit inicializaci všech preferencí při přihlášení
            $this->userPreferenceService->ensureUserPreferences($user, $request);

            // Flush se stane automaticky na konci requestu

            // Log login (this is the REAL login)
            $this->auditLogger->logLogin($user);
        }

        // Pro JSON požadavky vrať JSON odpověď
        if ($request->getContentType() === 'json') {
            // Zkontroluj, zda byl předán redirect_url v JSON datech
            $data = json_decode($request->getContent(), true);
            $redirectUrl = $data['redirect_url'] ?? null;

            return new JsonResponse([
                'success' => true,
                'redirect_url' => $redirectUrl,
                'user' => [
                    'INT_ADR' => $user->getIntAdr(),
                    'Jmeno' => $user->getJmeno(),
                    'Prijmeni' => $user->getPrijmeni(),
                    'eMail' => $user->getEmail(),
                    'Prukaz_znackare' => $user->getPrukazZnackare(),
                    'roles' => $user->getRoles()
                ]
            ]);
        }

        // Pro HTML formuláře zkontroluj redirect URL ze session
        $session = $request->getSession();
        $redirectUrl = $session->get('login_redirect_url');

        if ($redirectUrl) {
            // Vyčisti redirect URL ze session
            $session->remove('login_redirect_url');

            // Bezpečnostní kontrola - pouze interní URL
            if ($this->isInternalUrl($redirectUrl)) {
                return new RedirectResponse($redirectUrl);
            }
        }

        // Výchozí redirect na úvodní stránku (nástěnka)
        return new RedirectResponse('/');
    }

    /**
     * Kontroluje, zda je URL interní (začíná na / a neobsahuje //)
     */
    private function isInternalUrl(string $url): bool
    {
        return str_starts_with($url, '/') && !str_starts_with($url, '//');
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        // Získej username z requestu pro logování
        if ($request->getContentType() === 'json') {
            $data = json_decode($request->getContent(), true);
            $username = $data['username'] ?? 'unknown';
        } else {
            $username = $request->request->get('username', 'unknown');
        }

        // ✅ OPRAVA: Loguj failed login attempt
        $this->auditLogger->logFailedLogin(
            $username,
            $exception->getMessageKey(),
            $request->getClientIp(),
            $request->headers->get('User-Agent')
        );

        // Pro JSON požadavky vrať JSON odpověď
        if ($request->getContentType() === 'json') {
            return new JsonResponse([
                'success' => false,
                'message' => $exception->getMessageKey()
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Pro HTML formuláře přesměruj zpět s chybou
        $request->getSession()->getFlashBag()->add('error', 'Chyba přihlášení: ' . $exception->getMessageKey());
        return new RedirectResponse('/');
    }
}