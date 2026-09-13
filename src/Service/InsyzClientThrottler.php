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
        private int $windowSeconds = 900
    ) {
    }

    public function isBlocked(string $scope, string $identifier): bool
    {
        $item = $this->cache->getItem($this->key($scope, $identifier));

        return $item->isHit() && (int) $item->get() >= $this->maxAttempts;
    }

    public function registerFailure(string $scope, string $identifier): void
    {
        $item = $this->cache->getItem($this->key($scope, $identifier));
        $attempts = $item->isHit() ? (int) $item->get() : 0;

        $item->set($attempts + 1);
        $item->expiresAfter($this->windowSeconds);

        $this->cache->save($item);
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
