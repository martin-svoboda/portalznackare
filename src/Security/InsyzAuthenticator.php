<?php

namespace App\Security;

use App\Service\InsyzService;
use App\Service\AuditLogger;
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
        private UserRepository $userRepository
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
            
            // Flush se stane automaticky na konci requestu
            
            // Log login (this is the REAL login)
            $this->auditLogger->logLogin($user);
        }
        
        // Pro JSON požadavky vrať JSON odpověď
        if ($request->getContentType() === 'json') {
            return new JsonResponse([
                'success' => true,
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
        
        // Pro HTML formuláře přesměruj na dashboard
        return new RedirectResponse('/');
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
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