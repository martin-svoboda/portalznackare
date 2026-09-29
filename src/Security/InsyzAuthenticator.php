<?php

namespace App\Security;

use App\Service\InsyzClientThrottler;
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
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\RememberMeBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;

class InsyzAuthenticator extends AbstractAuthenticator
{
    private const THROTTLE_SCOPE = 'login';

    public function __construct(
        private InsyzService $insyzService,
        private InsyzUserProvider $userProvider,
        private AuditLogger $auditLogger,
        private UserRepository $userRepository,
        private UserPreferenceService $userPreferenceService,
        // Neúspěšné pokusy: per e-mail (5 / 15 min) a per IP (20 / 15 min), viz services.yaml
        #[Autowire(service: 'app.login_throttler.email')]
        private InsyzClientThrottler $emailThrottler,
        #[Autowire(service: 'app.login_throttler.ip')]
        private InsyzClientThrottler $ipThrottler
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
        if ($request->getContentTypeFormat() === 'json') {
            $data = json_decode($request->getContent(), true);
            $username = $data['username'] ?? '';
            $password = $data['password'] ?? '';
        } else {
            // Standard HTML form data
            $username = $request->request->get('username', '');
            $password = $request->request->get('password', '');
        }

        if (empty($username) || empty($password)) {
            throw new CustomUserMessageAuthenticationException('Vyplňte prosím email a heslo.');
        }

        // Při blokaci se INSYZ vůbec nevolá (a pokus se nepočítá – blokace se neprodlužuje)
        $email = $this->normalizeEmail($username);
        $ip = (string) $request->getClientIp();
        if ($this->emailThrottler->isBlocked(self::THROTTLE_SCOPE, $email)
            || $this->ipThrottler->isBlocked(self::THROTTLE_SCOPE, $ip)
        ) {
            $wait = max(
                $this->emailThrottler->retryAfter(self::THROTTLE_SCOPE, $email),
                $this->ipThrottler->retryAfter(self::THROTTLE_SCOPE, $ip)
            );
            throw new TooManyLoginAttemptsAuthenticationException(max(1, (int) ceil($wait / 60)));
        }

        try {
            // Ověř přes INSYZ — InsyzService hodí Exception s českou hláškou
            // určenou pro zobrazení uživateli (z validateLoginResponse).
            $intAdr = $this->insyzService->loginUser($username, $password);

            if (!$intAdr) {
                throw new CustomUserMessageAuthenticationException('Chyba přihlášení, zkontrolujte údaje a zkuste to znovu.');
            }

            return new SelfValidatingPassport(
                new UserBadge((string)$intAdr, function ($userIdentifier) {
                    return $this->userProvider->loadUserByIdentifier($userIdentifier);
                }),
                [new RememberMeBadge()]
            );

        } catch (CustomUserMessageAuthenticationException $e) {
            throw $e;
        } catch (\Exception $e) {
            throw new CustomUserMessageAuthenticationException($e->getMessage());
        }
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        $user = $token->getUser();

        // Úspěch nuluje čítač e-mailu (IP ne – jinak by si ho útočník s jedním platným účtem mazal)
        $this->emailThrottler->reset(self::THROTTLE_SCOPE, $this->normalizeEmail($this->getUsername($request)));

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
        if ($request->getContentTypeFormat() === 'json') {
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
    private function getUsername(Request $request): string
    {
        if ($request->getContentTypeFormat() === 'json') {
            $data = json_decode($request->getContent(), true);
            return (string) ($data['username'] ?? '');
        }

        return (string) $request->request->get('username', '');
    }

    private function normalizeEmail(string $username): string
    {
        return mb_strtolower(trim($username));
    }

    private function isInternalUrl(string $url): bool
    {
        return str_starts_with($url, '/') && !str_starts_with($url, '//');
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        // Získej username z requestu pro logování
        $username = $this->getUsername($request) ?: 'unknown';

        $throttled = $exception instanceof TooManyLoginAttemptsAuthenticationException;
        if ($throttled) {
            $message = sprintf(
                'Příliš mnoho neúspěšných pokusů o přihlášení. Zkuste to znovu za %d min.',
                $exception->getMessageData()['%minutes%'] ?? 15
            );
        } else {
            $message = $exception->getMessageKey();
            // Počítat jen skutečné pokusy s vyplněným e-mailem
            if ($username !== 'unknown') {
                $this->emailThrottler->registerFailure(self::THROTTLE_SCOPE, $this->normalizeEmail($username));
                $this->ipThrottler->registerFailure(self::THROTTLE_SCOPE, (string) $request->getClientIp());
            }
        }

        // ✅ OPRAVA: Loguj failed login attempt
        $this->auditLogger->logFailedLogin(
            $username,
            $message,
            $request->getClientIp(),
            $request->headers->get('User-Agent')
        );

        // Pro JSON požadavky vrať JSON odpověď
        if ($request->getContentTypeFormat() === 'json') {
            return new JsonResponse([
                'success' => false,
                'message' => $message
            ], $throttled ? Response::HTTP_TOO_MANY_REQUESTS : Response::HTTP_UNAUTHORIZED);
        }

        // Pro HTML formuláře přesměruj zpět s chybou
        $request->getSession()->getFlashBag()->add('error', 'Chyba přihlášení: ' . $message);
        return new RedirectResponse('/');
    }
}