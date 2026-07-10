<?php

namespace App\Enum;

/**
 * Číselník stavu provedení pro INSYZ – používá se pro obnovu úseků (Usek_Obnoven)
 * a do budoucna i pro další druhy příkazů (obnova tabulek apod.).
 *
 * Dohodnuto s INSYZ (Honza):
 *   0 - nevyhodnoceno (hodnota se z nějakého důvodu neuložila správně)
 *   1 - nevyplněno
 *   2 - Neprovedena  (UI: „Ne")
 *   3 - Provedena    (UI: „Ano")
 *   4 - Odložena
 * Portál nyní posílá 3/2, případně 0 jako fallback.
 */
enum StavProvedeniEnum: int
{
    case NEVYHODNOCENO = 0;
    case NEVYPLNENO = 1;
    case NEPROVEDENA = 2;
    case PROVEDENA = 3;
    case ODLOZENA = 4;

    public function getLabel(): string
    {
        return match ($this) {
            self::NEVYHODNOCENO => 'Nevyhodnoceno',
            self::NEVYPLNENO => 'Nevyplněno',
            self::NEPROVEDENA => 'Neprovedena',
            self::PROVEDENA => 'Provedena',
            self::ODLOZENA => 'Odložena',
        };
    }

    /**
     * Normalizuje uloženou hodnotu Usek_Obnoven na kód číselníku.
     * Zvládne i starý formát (boolean true/false) i číselné kódy.
     */
    public static function normalize(mixed $value): self
    {
        // Starý boolean formát
        if ($value === true) {
            return self::PROVEDENA;
        }
        if ($value === false) {
            return self::NEPROVEDENA;
        }

        // Číselný kód (int nebo číselný string)
        if (is_int($value) || (is_string($value) && ctype_digit($value))) {
            return self::tryFrom((int) $value) ?? self::NEVYHODNOCENO;
        }

        return self::NEVYHODNOCENO;
    }
}
