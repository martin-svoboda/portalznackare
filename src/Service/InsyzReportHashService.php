<?php

namespace App\Service;

/**
 * Deterministický podpis URL pro read-only náhled hlášení (pro správce INSYZ).
 *
 * Používá stejný mechanismus jako hashování hesel v INSYZ:
 *   UPPER(CONVERT(VARCHAR(40), HASHBYTES('SHA1', @text), 2))
 * tj. strtoupper(sha1(...)). Vstupem je sdílený tajný klíč + číslo příkazu
 * (cisloZp), které NENÍ v URL (v URL je jen id příkazu).
 */
class InsyzReportHashService
{
    public function __construct(
        private readonly string $insyzReportHashSecret
    ) {
    }

    public function generate(string $cisloZp): string
    {
        return strtoupper(sha1($this->insyzReportHashSecret . $cisloZp));
    }

    public function verify(string $cisloZp, string $hash): bool
    {
        if ($cisloZp === '' || $hash === '') {
            return false;
        }

        return hash_equals($this->generate($cisloZp), strtoupper($hash));
    }
}
