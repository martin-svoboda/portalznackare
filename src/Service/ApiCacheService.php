<?php

namespace App\Service;

use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Psr\Log\LoggerInterface;

class ApiCacheService
{
    private const CACHE_TTL_PRIKAZY_LIST = 300;    // 5 minut - seznam příkazů
    private const CACHE_TTL_PRIKAZ_DETAIL = 120;   // 2 minuty - detail příkazu
    private const CACHE_TTL_USER_DATA = 1800;      // 30 minut - uživatelská data
    private const CACHE_TTL_SAZBY = 3600;          // 1 hodina - sazby (mění se zřídka)

    public function __construct(
        private CacheInterface $cache,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Cache pro seznam příkazů uživatele
     */
    public function getCachedPrikazy(int $intAdr, ?int $year, callable $dataProvider): array
    {
        $cacheKey = sprintf('api.prikazy.%d.%d', $intAdr, $year ?? date('Y'));
        
        return $this->cache->get($cacheKey, function (ItemInterface $item) use ($dataProvider, $intAdr, $year) {
            $item->expiresAfter(self::CACHE_TTL_PRIKAZY_LIST);
            
            $startTime = microtime(true);
            $data = $dataProvider($intAdr, $year);
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            $this->logger->info('API Cache MISS: Prikazy loaded from INSYZ', [
                'int_adr' => $intAdr,
                'year' => $year,
                'duration_ms' => $duration,
                'items_count' => count($data)
            ]);
            
            return $data;
        });
    }

    /**
     * Cache pro detail příkazu
     */
    public function getCachedPrikaz(int $intAdr, int $prikazId, callable $dataProvider): array
    {
        $cacheKey = sprintf('api.prikaz.%d.%d', $intAdr, $prikazId);
        
        return $this->cache->get($cacheKey, function (ItemInterface $item) use ($dataProvider, $intAdr, $prikazId) {
            $item->expiresAfter(self::CACHE_TTL_PRIKAZ_DETAIL);
            
            $startTime = microtime(true);
            $data = $dataProvider($intAdr, $prikazId);
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            $this->logger->info('API Cache MISS: Prikaz detail loaded from INSYZ', [
                'int_adr' => $intAdr,
                'prikaz_id' => $prikazId,
                'duration_ms' => $duration
            ]);
            
            return $data;
        });
    }

    /**
     * Cache pro uživatelská data
     */
    public function getCachedUserData(int $intAdr, callable $dataProvider): array
    {
        $cacheKey = sprintf('api.user.%d', $intAdr);
        
        return $this->cache->get($cacheKey, function (ItemInterface $item) use ($dataProvider, $intAdr) {
            $item->expiresAfter(self::CACHE_TTL_USER_DATA);
            
            $startTime = microtime(true);
            $data = $dataProvider($intAdr);
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            $this->logger->info('API Cache MISS: User data loaded from INSYZ', [
                'int_adr' => $intAdr,
                'duration_ms' => $duration
            ]);
            
            return $data;
        });
    }

    /**
     * Cache pro sazby
     */
    public function getCachedSazby(?string $date, callable $dataProvider): array
    {
        $cacheKey = sprintf('api.sazby.%s', $date ?? date('Y-m-d'));
        
        return $this->cache->get($cacheKey, function (ItemInterface $item) use ($dataProvider, $date) {
            $item->expiresAfter(self::CACHE_TTL_SAZBY);
            
            $startTime = microtime(true);
            $data = $dataProvider($date);
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            $this->logger->info('API Cache MISS: Sazby loaded', [
                'date' => $date,
                'duration_ms' => $duration
            ]);
            
            return $data;
        });
    }

    /**
     * Invalidace cache při změně dat uživatele
     */
    public function invalidateUserCache(int $intAdr): void
    {
        $patterns = [
            sprintf('api.user.%d', $intAdr),
            sprintf('api.prikazy.%d.*', $intAdr),
            sprintf('api.prikaz.%d.*', $intAdr),
        ];

        foreach ($patterns as $pattern) {
            $this->cache->delete($pattern);
        }

        $this->logger->info('API Cache invalidated for user', [
            'int_adr' => $intAdr,
            'patterns' => $patterns
        ]);
    }

    /**
     * Invalidace cache konkrétního příkazu
     */
    public function invalidatePrikazCache(int $intAdr, int $prikazId): void
    {
        $cacheKey = sprintf('api.prikaz.%d.%d', $intAdr, $prikazId);
        $this->cache->delete($cacheKey);
        
        $this->logger->info('API Cache invalidated for prikaz', [
            'int_adr' => $intAdr,
            'prikaz_id' => $prikazId
        ]);
    }

    /**
     * Získání cache statistik
     */
    public function getCacheStats(): array
    {
        // Implementace závisí na cache adapteru
        // Pro Redis adapter by to bylo jiné než pro file cache
        return [
            'adapter_class' => get_class($this->cache),
            'timestamp' => time()
        ];
    }
}