<?php

namespace App\Service;

use Psr\Cache\CacheItemPoolInterface;

/**
 * Jednoduchý throttling neúspěšných pokusů pro endpoint vydávající hesla k INSYZ DB.
 *
 * Klouzavé okno nad cache poolem (cache.app) — dvě nezávislé řady čítačů: per IP
 * a per uživatel. Každé další selhání okno posouvá, takže po vypršení bez pokusů
 * blokace sama padá.
 *
 * Projekt nemá symfony/rate-limiter a kvůli dočasnému endpointu se nová závislost
 * nezavádí.
 */
class InsyzClientThrottler
{
    private const PREFIX = 'insyz_client_throttle_';

    public function __construct(
        private CacheItemPoolInterface $cache,
        private int $maxAttempts = 10,
        private int $windowSeconds = 300
    ) {
    }

    public function isBlocked(string $scope, string $identifier): bool
    {
        return $this->state($scope, $identifier)['count'] >= $this->maxAttempts;
    }

    /**
     * Kolik sekund zbývá do vypršení blokace. Nula, když blokace neběží.
     */
    public function retryAfter(string $scope, string $identifier): int
    {
        $state = $this->state($scope, $identifier);

        if ($state['count'] < $this->maxAttempts) {
            return 0;
        }

        return max(0, $state['until'] - time());
    }

    public function registerFailure(string $scope, string $identifier): void
    {
        $item = $this->cache->getItem($this->key($scope, $identifier));
        $state = $this->state($scope, $identifier);

        $item->set(['count' => $state['count'] + 1, 'until' => time() + $this->windowSeconds]);
        $item->expiresAfter($this->windowSeconds);

        $this->cache->save($item);
    }

    /**
     * @return array{count: int, until: int}
     */
    private function state(string $scope, string $identifier): array
    {
        $item = $this->cache->getItem($this->key($scope, $identifier));

        if (!$item->isHit()) {
            return ['count' => 0, 'until' => 0];
        }

        $value = $item->get();

        // starší záznamy v cache držely jen číslo
        if (!is_array($value)) {
            return ['count' => (int) $value, 'until' => time() + $this->windowSeconds];
        }

        return ['count' => (int) ($value['count'] ?? 0), 'until' => (int) ($value['until'] ?? 0)];
    }

    public function reset(string $scope, string $identifier): void
    {
        $this->cache->deleteItem($this->key($scope, $identifier));
    }

    private function key(string $scope, string $identifier): string
    {
        // sha1 kvůli znakům nepovoleným v PSR-6 klíčích a kvůli tomu,
        // aby se do cache úložiště nezapisovalo uživatelské jméno v čitelné podobě
        return self::PREFIX . $scope . '_' . sha1($identifier);
    }
}
