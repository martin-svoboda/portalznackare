<?php

namespace App\Controller\Api;

use App\Exception\InsyzClientAuthException;
use App\Service\InsyzClientCredentialsService;
use App\Service\InsyzClientThrottler;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Vydávání hesel k INSYZ databázím desktopovému klientovi.
 *
 * Bez session a bez tokenů — klient posílá své přihlašovací údaje při každém
 * požadavku a dostane heslo právě k jednomu databázovému účtu.
 */
#[Route('/api/insyz-client')]
class InsyzClientController extends AbstractController
{
    /** Jediná chybová hláška pro všechny důvody selhání kromě blokace */
    private const GENERIC_ERROR = 'Přístup byl odmítnut.';

    /**
     * Blokace se přiznává zvlášť. Neprozrazuje nic o existenci účtu — čítač roste
     * i u neznámého uživatele a neznámého klíče — a bez ní uživatel netuší,
     * proč mu nepomůže ani správné heslo.
     */
    private const THROTTLED_ERROR = 'Příliš mnoho neúspěšných pokusů. Přístup je dočasně zablokovaný.';

    public function __construct(
        private InsyzClientCredentialsService $credentials,
        private InsyzClientThrottler $throttler,
        private LoggerInterface $logger,
        private bool $requireHttps
    ) {
    }

    #[Route('/db-password', name: 'api_insyz_client_db_password', methods: ['POST'])]
    public function dbPassword(Request $request): JsonResponse
    {
        $ip = (string) $request->getClientIp();

        if ($this->requireHttps && !$request->isSecure()) {
            $this->log($ip, null, null, false, 'insecure_transport');

            return $this->denied();
        }

        $payload = json_decode($request->getContent(), true);

        $user = is_array($payload) ? $payload['user'] ?? null : null;
        $password = is_array($payload) ? $payload['password'] ?? null : null;
        $key = is_array($payload) ? $payload['key'] ?? null : null;

        if (!is_string($user) || !is_string($password) || !is_string($key)
            || $user === '' || $password === '' || $key === '') {
            $this->log($ip, null, null, false, InsyzClientAuthException::REASON_INVALID_REQUEST);

            return $this->denied();
        }

        if ($this->throttler->isBlocked('ip', $ip) || $this->throttler->isBlocked('user', $user)) {
            $this->log($ip, $user, $key, false, InsyzClientAuthException::REASON_THROTTLED);

            return $this->throttled($ip, $user);
        }

        try {
            $dbPassword = $this->credentials->getDbPassword($user, $password, $key);
        } catch (InsyzClientAuthException $e) {
            $this->throttler->registerFailure('ip', $ip);
            $this->throttler->registerFailure('user', $user);
            $this->log($ip, $user, $key, false, $e->getReason());

            // Když právě tenhle pokus limit přetáhl, řekni to hned — ať uživatel
            // nezkouší dál s pocitem, že jen špatně napsal heslo.
            if ($this->throttler->isBlocked('ip', $ip) || $this->throttler->isBlocked('user', $user)) {
                return $this->throttled($ip, $user);
            }

            return $this->denied();
        } catch (\Throwable $e) {
            // Chyba spojení s DB apod. — ven jde stejná hláška, detail jen do logu
            $this->log($ip, $user, $key, false, 'internal_error: ' . $e->getMessage());

            return $this->denied();
        }

        $this->throttler->reset('user', $user);
        $this->throttler->reset('ip', $ip);
        $this->log($ip, $user, $key, true, null);

        return new JsonResponse(['password' => $dbPassword]);
    }

    private function denied(): JsonResponse
    {
        return new JsonResponse(['error' => self::GENERIC_ERROR], Response::HTTP_UNAUTHORIZED);
    }

    private function throttled(string $ip, string $user): JsonResponse
    {
        $retryAfter = max(
            $this->throttler->retryAfter('ip', $ip),
            $this->throttler->retryAfter('user', $user)
        );

        return new JsonResponse(
            ['error' => self::THROTTLED_ERROR, 'retry_after' => $retryAfter],
            Response::HTTP_TOO_MANY_REQUESTS,
            ['Retry-After' => (string) $retryAfter]
        );
    }

    /**
     * Do logu nikdy nejde heslo uživatele ani vydané heslo k databázi.
     */
    private function log(string $ip, ?string $user, ?string $key, bool $success, ?string $reason): void
    {
        $this->logger->info('INSYZ client db-password request', [
            'time' => (new \DateTimeImmutable())->format(DATE_ATOM),
            'ip' => $ip,
            'user' => $user,
            'key' => $key,
            'result' => $success ? 'success' : 'failure',
            'reason' => $reason,
        ]);
    }
}
