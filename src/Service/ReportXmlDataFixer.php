<?php

namespace App\Service;

use App\Enum\StavProvedeniEnum;

/**
 * Čistá (bezstavová) transformace uložených dat hlášení na konzistentní tvar
 * pro generování XML do INSYZ. Opravuje tři historické chyby v datech:
 *
 *  1) datum noclehu – doplní calculation[INT_ADR].Noclezne[].Datum z data_a.Noclezne[].Datum
 *  3) ID úseku       – překlíčuje data_b.Obnovene_Useky z EvCi_Tra na ID úseku z INSYZ
 *                      (ID_TRASY_Odbocky ?? ID_Trasy_ZU); nejednoznačné odbočky vynechá
 *  4) předměty 2×    – znormalizuje data_b.Stavy_Tim[*].Predmety na objekt klíčovaný ID_PREDMETY
 *
 * Všechny transformace jsou idempotentní – opakované spuštění už nic nezmění.
 */
class ReportXmlDataFixer
{
    /**
     * @param array      $dataA
     * @param array      $dataB
     * @param array      $calculation
     * @param array|null $useky  Úseky příkazu z INSYZ (kvůli mapě EvCi_Tra → ID úseku).
     *                           null = úseky se nepodařilo načíst → Obnovene_Useky se nemění.
     *
     * @return array{data_a: array, data_b: array, calculation: array, changes: string[], warnings: string[], changed: bool}
     */
    public function fix(array $dataA, array $dataB, array $calculation, ?array $useky): array
    {
        $changes = [];
        $warnings = [];

        // (4) Předměty
        [$dataB, $predChanges] = $this->fixPredmety($dataB);
        $changes = array_merge($changes, $predChanges);

        // (1) Datum noclehu
        [$calculation, $nocChanges] = $this->fixNoclezneDatum($dataA, $calculation);
        $changes = array_merge($changes, $nocChanges);

        // (3) ID úseku
        if ($useky !== null) {
            [$dataB, $usekChanges, $usekWarnings] = $this->fixObnoveneUseky($dataB, $useky);
            $changes = array_merge($changes, $usekChanges);
            $warnings = array_merge($warnings, $usekWarnings);
        } elseif (!empty($dataB['Obnovene_Useky'])) {
            $warnings[] = 'Úseky z INSYZ nedostupné – Obnovene_Useky ponechány beze změny';
        }

        return [
            'data_a' => $dataA,
            'data_b' => $dataB,
            'calculation' => $calculation,
            'changes' => $changes,
            'warnings' => $warnings,
            'changed' => !empty($changes),
        ];
    }

    /**
     * (4) Znormalizuje Predmety v každém TIM na objekt klíčovaný ID_PREDMETY.
     * Záznamy editované uživatelem (klíč == ID_PREDMETY) mají přednost; předvyplněné
     * záznamy s číselným klíčem (0,1,2…) se buď zahodí jako duplicita, nebo překlíčují,
     * pokud daný předmět ještě v cíli není.
     *
     * @return array{0: array, 1: string[]}
     */
    private function fixPredmety(array $dataB): array
    {
        $changes = [];

        if (!isset($dataB['Stavy_Tim']) || !is_array($dataB['Stavy_Tim'])) {
            return [$dataB, $changes];
        }

        foreach ($dataB['Stavy_Tim'] as $timId => $timReport) {
            if (!is_array($timReport) || !isset($timReport['Predmety']) || !is_array($timReport['Predmety'])) {
                continue;
            }

            $predmety = $timReport['Predmety'];
            $normalized = [];

            // 1. průchod: kanonické záznamy (klíč == ID_PREDMETY)
            foreach ($predmety as $key => $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $idp = isset($entry['ID_PREDMETY']) ? (string) $entry['ID_PREDMETY'] : null;
                if ($idp !== null && (string) $key === $idp) {
                    $normalized[$idp] = $entry;
                }
            }

            // 2. průchod: předvyplněné záznamy (číselný klíč) jen pokud daný předmět ještě chybí
            foreach ($predmety as $key => $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $idp = isset($entry['ID_PREDMETY']) ? (string) $entry['ID_PREDMETY'] : null;
                if ($idp === null) {
                    // Defenzivně zachovat neznámý záznam beze změny
                    $normalized[$key] = $entry;
                    continue;
                }
                if ((string) $key === $idp) {
                    continue; // už v 1. průchodu
                }
                if (!isset($normalized[$idp])) {
                    $normalized[$idp] = $entry;
                }
            }

            // Změna jen pokud se liší klíče (pořadí ani počet)
            if (array_keys($predmety) !== array_keys($normalized)) {
                $dataB['Stavy_Tim'][$timId]['Predmety'] = $normalized;
                $removed = count($predmety) - count($normalized);
                $changes[] = $removed > 0
                    ? sprintf('Predmety TIM %s: odstraněno %d duplicit (%d → %d)', (string) $timId, $removed, count($predmety), count($normalized))
                    : sprintf('Predmety TIM %s: překlíčováno na ID_PREDMETY (%d záznamů)', (string) $timId, count($normalized));
            }
        }

        return [$dataB, $changes];
    }

    /**
     * (1) Doplní Datum k nocležnému ve vyúčtování podle zdroje v části A (párování přes id).
     *
     * @return array{0: array, 1: string[]}
     */
    private function fixNoclezneDatum(array $dataA, array $calculation): array
    {
        $changes = [];

        $datumById = [];
        foreach ($dataA['Noclezne'] ?? [] as $nocleh) {
            if (is_array($nocleh) && isset($nocleh['id'])) {
                $datumById[(string) $nocleh['id']] = $nocleh['Datum'] ?? null;
            }
        }

        if (empty($datumById) || empty($calculation)) {
            return [$calculation, $changes];
        }

        foreach ($calculation as $intAdr => $member) {
            if (!is_array($member) || !isset($member['Noclezne']) || !is_array($member['Noclezne'])) {
                continue;
            }

            foreach ($member['Noclezne'] as $idx => $nocleh) {
                if (!is_array($nocleh)) {
                    continue;
                }
                $hasDatum = isset($nocleh['Datum']) && $nocleh['Datum'] !== '' && $nocleh['Datum'] !== null;
                if ($hasDatum || !isset($nocleh['id'])) {
                    continue;
                }
                $src = $datumById[(string) $nocleh['id']] ?? null;
                if ($src === null || $src === '') {
                    continue;
                }

                $member['Noclezne'][$idx] = $this->withDatum($nocleh, $this->normalizeDate($src));
                $changes[] = sprintf('Noclezne %s (INT_ADR %s): doplněno Datum %s', (string) ($nocleh['id'] ?? '?'), (string) $intAdr, $this->normalizeDate($src));
            }

            $calculation[$intAdr] = $member;
        }

        return [$calculation, $changes];
    }

    /**
     * (3) Překlíčuje Obnovene_Useky z EvCi_Tra na ID úseku z INSYZ.
     *
     * @return array{0: array, 1: string[], 2: string[]}
     */
    private function fixObnoveneUseky(array $dataB, array $useky): array
    {
        $changes = [];
        $warnings = [];

        if (empty($dataB['Obnovene_Useky']) || !is_array($dataB['Obnovene_Useky'])) {
            return [$dataB, $changes, $warnings];
        }

        $usekMap = $this->buildUsekMap($useky);
        $map = $usekMap['map'];
        $validIds = $usekMap['validIds'];
        $ambiguous = $usekMap['ambiguous'];
        $byEvciAll = $usekMap['byEvciAll'];
        $byId = $usekMap['byId'];

        $new = [];
        foreach ($dataB['Obnovene_Useky'] as $key => $record) {
            $k = (string) $key;

            if (isset($validIds[$k])) {
                $new[$k] = $record; // už je to ID úseku → ponechat
                continue;
            }
            if (isset($ambiguous[$k])) {
                // Staré FE klíčovalo podle EvCi_Tra a všechny úseky/odbočky trasy slilo
                // do jednoho záznamu. Hlášení se odevzdává jen při plné obnově, takže
                // slitá hodnota platí pro všechny úseky té trasy → rozgnout na reálná ID.
                // Usek_Delka bereme z INSYZ (Delka_ZU), Usek_Obnoven z legacy záznamu.
                $ids = [];
                foreach ($byEvciAll[$k] as $u) {
                    // Zachovat původní pole záznamu (Usek_Obnoven i případné Usek_Obnoven_Km),
                    // přepsat Usek_Delka z INSYZ a doplnit příznak Typ_Useku (Úsek/Odbočka).
                    // Usek_Obnoven znormalizuje finální průchol níže.
                    $new[$u['id']] = array_merge($record, [
                        'Usek_Delka' => $u['delka'],
                        'Typ_Useku' => $u['typ'],
                    ]);
                    $ids[] = $u['id'];
                }
                $changes[] = sprintf('Obnovene_Useky: EvCi_Tra %s rozgnuto na %d úseků (%s)', $k, count($ids), implode(', ', $ids));
                continue;
            }
            if (isset($map[$k])) {
                $new[$map[$k]] = $record;
                $changes[] = sprintf('Obnovene_Useky: EvCi_Tra %s → ID úseku %s', $k, $map[$k]);
                continue;
            }

            $new[$k] = $record;
            $warnings[] = sprintf('Úsek %s: nenalezen v aktuálních datech příkazu z INSYZ, ponechán beze změny', $k);
        }

        // Finální průchod přes VŠECHNY úseky:
        //  a) Usek_Obnoven na číselník StavProvedeniEnum (starý boolean true/false → 3/2).
        //  b) doplnit chybějící Typ_Useku (Úsek/Odbočka) z INSYZ, aby se do XML dostal
        //     příznak typ i u neexpandovaných úseků.
        // Číselné kódy / už vyplněný Typ_Useku zůstanou beze změny (idempotentní).
        $migrated = 0;
        $typDoplneno = 0;
        foreach ($new as $id => $rec) {
            if (array_key_exists('Usek_Obnoven', $rec)) {
                $kod = StavProvedeniEnum::normalize($rec['Usek_Obnoven'])->value;
                if ($rec['Usek_Obnoven'] !== $kod) {
                    $new[$id]['Usek_Obnoven'] = $kod;
                    $migrated++;
                }
            }
            if (empty($rec['Typ_Useku']) && !empty($byId[(string) $id]['typ'])) {
                $new[$id]['Typ_Useku'] = $byId[(string) $id]['typ'];
                $typDoplneno++;
            }
        }
        if ($migrated > 0) {
            $changes[] = sprintf('Obnovene_Useky: Usek_Obnoven převeden na číselník u %d úseků', $migrated);
        }
        if ($typDoplneno > 0) {
            $changes[] = sprintf('Obnovene_Useky: doplněn Typ_Useku u %d úseků', $typDoplneno);
        }

        $dataB['Obnovene_Useky'] = $new;

        return [$dataB, $changes, $warnings];
    }

    /**
     * Sestaví mapu EvCi_Tra → ID úseku z úseků příkazu. Pracuje jen se skutečnými ID
     * (ID_TRASY_Odbocky ?? ID_Trasy_ZU), aby se EvCi_Tra-klíče nezaměnily za „už migrované".
     * Úseky bez reálného ID (chybná data z INSYZ, např. „Nedostupná odbočka" s ID = null
     * a EvCi_Tra „N/A") se ignorují.
     *
     * @return array{
     *   map: array<string,string>,
     *   validIds: array<string,bool>,
     *   ambiguous: array<string,int>,
     *   byEvciAll: array<string, list<array{id: string, delka: float}>>
     * }
     */
    public function buildUsekMap(array $useky): array
    {
        $counts = [];
        $byEvci = [];
        $byEvciAll = [];
        $byId = [];
        $validIds = [];

        foreach ($useky as $usek) {
            if (!is_array($usek)) {
                continue;
            }
            $usekId = $usek['ID_TRASY_Odbocky'] ?? $usek['ID_Trasy_ZU'] ?? null;
            if ($usekId === null || $usekId === '') {
                continue; // neplatný úsek (N/A) – ignorujeme
            }
            $usekId = (string) $usekId;
            $validIds[$usekId] = true;
            $byId[$usekId] = [
                'delka' => isset($usek['Delka_ZU']) ? (float) $usek['Delka_ZU'] : 0.0,
                'typ' => isset($usek['Typ_Useku']) ? (string) $usek['Typ_Useku'] : '',
            ];

            $evci = isset($usek['EvCi_Tra']) ? (string) $usek['EvCi_Tra'] : '';
            if ($evci === '') {
                continue;
            }
            $counts[$evci] = ($counts[$evci] ?? 0) + 1;
            $byEvci[$evci] = $usekId;
            $byEvciAll[$evci][] = [
                'id' => $usekId,
                'delka' => isset($usek['Delka_ZU']) ? (float) $usek['Delka_ZU'] : 0.0,
                'typ' => isset($usek['Typ_Useku']) ? (string) $usek['Typ_Useku'] : '',
            ];
        }

        $map = [];
        $ambiguous = [];
        foreach ($counts as $evci => $count) {
            if ($count === 1) {
                $map[$evci] = $byEvci[$evci];
            } else {
                $ambiguous[$evci] = $count;
            }
        }

        return ['map' => $map, 'validIds' => $validIds, 'ambiguous' => $ambiguous, 'byEvciAll' => $byEvciAll, 'byId' => $byId];
    }

    /**
     * Vrátí nocleh s Datem zařazeným hned za id (kvůli čitelnému pořadí elementů v XML).
     */
    private function withDatum(array $nocleh, string $datum): array
    {
        $ordered = [];
        if (isset($nocleh['id'])) {
            $ordered['id'] = $nocleh['id'];
        }
        $ordered['Datum'] = $datum;
        foreach ($nocleh as $k => $v) {
            if ($k !== 'id' && $k !== 'Datum') {
                $ordered[$k] = $v;
            }
        }
        return $ordered;
    }

    /**
     * Normalizuje datum na tvar Y-m-d (shodně s frontendem toISODateString).
     */
    private function normalizeDate(string $value): string
    {
        if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $value, $m)) {
            return $m[1];
        }
        $ts = strtotime($value);
        return $ts !== false ? date('Y-m-d', $ts) : $value;
    }
}
