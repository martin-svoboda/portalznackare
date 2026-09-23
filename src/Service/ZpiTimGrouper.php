<?php

namespace App\Service;

/**
 * Seskupení TIMů příkazu ZP-I pro tisk kontrolního formuláře (INSYZ-282).
 *
 * PHP obdoba `seskupTimyZpi()` z frontendu: seznam TIMů je sjednocení TIMů s předměty
 * a TIMů ze servisního datasetu (servisní TIM žádné předměty nemá), uvnitř TIMu jdou
 * položky v pořadí servis → odinstalace → instalace (INSYZ-280 bod 5.2).
 */
class ZpiTimGrouper
{
    private const PORADI_CINNOSTI = ['servis', 'odinstalace', 'instalace'];

    /**
     * @param array $predmety   předměty příkazu (obohacené, s klíčem Cinnost)
     * @param array $servisTimy dataset ZP_ServTIM
     *
     * @return array<int, array{EvCi_TIM: string, Naz_TIM: ?string, NP: ?string, items: array}>
     */
    public function seskup(array $predmety, array $servisTimy): array
    {
        $timy = [];

        $zajisti = function (string $evCiTim, ?string $naz) use (&$timy): void {
            if (!isset($timy[$evCiTim])) {
                $timy[$evCiTim] = [
                    'EvCi_TIM' => $evCiTim,
                    'Naz_TIM' => $naz,
                    'NP' => null,
                    'items' => [],
                ];
            }
        };

        foreach ($predmety as $predmet) {
            $evCiTim = (string) ($predmet['EvCi_TIM'] ?? '');
            if ('' === $evCiTim) {
                continue;
            }

            $zajisti($evCiTim, $predmet['Naz_TIM'] ?? null);
            $timy[$evCiTim]['NP'] ??= $predmet['NP'] ?? null;

            $predmet['Cinnost'] ??= str_starts_with((string) ($predmet['Co_Provest'] ?? ''), 'Zrušit')
                ? 'odinstalace'
                : 'instalace';

            $timy[$evCiTim]['items'][] = $predmet;
        }

        foreach ($servisTimy as $servis) {
            $evCiTim = (string) ($servis['EvCi_TIM'] ?? '');
            if ('' === $evCiTim) {
                continue;
            }

            $zajisti($evCiTim, $servis['Naz_TIM'] ?? null);
            $timy[$evCiTim]['items'][] = $servis + ['Cinnost' => 'servis'];
        }

        foreach ($timy as $evCiTim => $tim) {
            usort($tim['items'], fn ($a, $b) => array_search($a['Cinnost'], self::PORADI_CINNOSTI, true)
                <=> array_search($b['Cinnost'], self::PORADI_CINNOSTI, true));
            $timy[$evCiTim] = $tim;
        }

        return array_values($timy);
    }
}
