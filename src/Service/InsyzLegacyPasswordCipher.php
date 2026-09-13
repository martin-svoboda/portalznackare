<?php

namespace App\Service;

/**
 * Dešifrování hesla uživatele ze sloupce trasy.ptUzivatele.Uziv_Info.
 *
 * Stávající schéma INSYZ: DES-CBC (PKCS#7 padding), base64, text v UTF-16LE.
 * Klíč ani IV nejsou tajemství — jsou to fixní parametry historického schématu,
 * které je natvrdo i v desktopovém klientovi. Chrání sloupec v DB, ne přenos.
 *
 * DES není implementován přes openssl_decrypt(): v OpenSSL 3 spadl do legacy
 * provideru, který na PHP 8.3 není aktivní a nelze ho zapnout z kódu
 * ("digital envelope routines::unsupported"). Proto vlastní DES níže —
 * dešifrování jednoho bloku při přihlášení, výkon nehraje roli.
 */
final class InsyzLegacyPasswordCipher
{
    private const KEY = [0x01, 0x03, 0x03, 0x04, 0x08, 0x06, 0x07, 0x08];
    private const IV  = [0x02, 0x02, 0x03, 0x04, 0x05, 0x08, 0x07, 0x02];

    private const IP = [
        58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
        62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
        57, 49, 41, 33, 25, 17,  9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
        61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
    ];

    private const FP = [
        40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
        38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
        36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
        34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41,  9, 49, 17, 57, 25,
    ];

    private const E = [
        32,  1,  2,  3,  4,  5,  4,  5,  6,  7,  8,  9,
         8,  9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
        16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
        24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32,  1,
    ];

    private const P = [
        16,  7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
         2,  8, 24, 14, 32, 27,  3,  9, 19, 13, 30, 6, 22, 11,  4, 25,
    ];

    private const PC1 = [
        57, 49, 41, 33, 25, 17,  9,  1, 58, 50, 42, 34, 26, 18,
        10,  2, 59, 51, 43, 35, 27, 19, 11,  3, 60, 52, 44, 36,
        63, 55, 47, 39, 31, 23, 15,  7, 62, 54, 46, 38, 30, 22,
        14,  6, 61, 53, 45, 37, 29, 21, 13,  5, 28, 20, 12,  4,
    ];

    private const PC2 = [
        14, 17, 11, 24,  1,  5,  3, 28, 15,  6, 21, 10,
        23, 19, 12,  4, 26,  8, 16,  7, 27, 20, 13,  2,
        41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
        44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
    ];

    private const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

    private const SBOX = [
        [
            [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
            [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
            [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
            [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
        ],
        [
            [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
            [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
            [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
            [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
        ],
        [
            [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
            [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
            [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
            [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
        ],
        [
            [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
            [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
            [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
            [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
        ],
        [
            [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
            [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
            [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
            [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
        ],
        [
            [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
            [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
            [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
            [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
        ],
        [
            [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
            [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
            [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
            [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
        ],
        [
            [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
            [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
            [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
            [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
        ],
    ];

    /**
     * Dešifruje obsah sloupce Uziv_Info na heslo v UTF-8.
     * Vrací null pro jakýkoli nevalidní vstup (nečitelný base64, špatná délka,
     * poškozený padding, nevalidní UTF-16) — volající to řeší jako neúspěšné ověření.
     */
    public function decrypt(string $base64): ?string
    {
        $cipher = base64_decode(trim($base64), true);

        if ($cipher === false || $cipher === '' || strlen($cipher) % 8 !== 0) {
            return null;
        }

        $subkeys = $this->keySchedule(self::KEY);
        $previous = self::IV;
        $plain = '';

        foreach (str_split($cipher, 8) as $block) {
            $bytes = array_values(unpack('C*', $block));
            $decrypted = $this->processBlock($bytes, array_reverse($subkeys));

            foreach ($decrypted as $i => $byte) {
                $plain .= chr($byte ^ $previous[$i]);
            }

            $previous = $bytes;
        }

        $plain = $this->stripPkcs7($plain);

        if ($plain === null) {
            return null;
        }

        // Prázdný řetězec je validní výstup padding, ale ne validní heslo
        if ($plain === '') {
            return null;
        }

        if (strlen($plain) % 2 !== 0) {
            return null;
        }

        $utf8 = @iconv('UTF-16LE', 'UTF-8', $plain);

        return $utf8 === false ? null : $utf8;
    }

    /**
     * @param int[] $block 8 bajtů
     * @param int[][] $subkeys 16 podklíčů (pro dešifrování v opačném pořadí)
     * @return int[] 8 bajtů
     */
    private function processBlock(array $block, array $subkeys): array
    {
        $bits = $this->bytesToBits($block);
        $bits = $this->permute($bits, self::IP);

        $left = array_slice($bits, 0, 32);
        $right = array_slice($bits, 32, 32);

        foreach ($subkeys as $subkey) {
            $previousRight = $right;
            $right = $this->xorBits($left, $this->feistel($right, $subkey));
            $left = $previousRight;
        }

        // Po posledním kole se poloviny prohazují (preswap)
        return $this->bitsToBytes($this->permute(array_merge($right, $left), self::FP));
    }

    /**
     * @param int[] $right 32 bitů
     * @param int[] $subkey 48 bitů
     * @return int[] 32 bitů
     */
    private function feistel(array $right, array $subkey): array
    {
        $expanded = $this->xorBits($this->permute($right, self::E), $subkey);
        $output = [];

        for ($box = 0; $box < 8; $box++) {
            $chunk = array_slice($expanded, $box * 6, 6);
            $row = ($chunk[0] << 1) | $chunk[5];
            $column = ($chunk[1] << 3) | ($chunk[2] << 2) | ($chunk[3] << 1) | $chunk[4];
            $value = self::SBOX[$box][$row][$column];

            $output[] = ($value >> 3) & 1;
            $output[] = ($value >> 2) & 1;
            $output[] = ($value >> 1) & 1;
            $output[] = $value & 1;
        }

        return $this->permute($output, self::P);
    }

    /**
     * @param int[] $key 8 bajtů
     * @return int[][] 16 podklíčů po 48 bitech
     */
    private function keySchedule(array $key): array
    {
        $bits = $this->permute($this->bytesToBits($key), self::PC1);
        $c = array_slice($bits, 0, 28);
        $d = array_slice($bits, 28, 28);

        $subkeys = [];

        foreach (self::SHIFTS as $shift) {
            $c = array_merge(array_slice($c, $shift), array_slice($c, 0, $shift));
            $d = array_merge(array_slice($d, $shift), array_slice($d, 0, $shift));
            $subkeys[] = $this->permute(array_merge($c, $d), self::PC2);
        }

        return $subkeys;
    }

    /**
     * @param int[] $bits
     * @param int[] $table 1-based pozice zdrojových bitů
     * @return int[]
     */
    private function permute(array $bits, array $table): array
    {
        $result = [];

        foreach ($table as $position) {
            $result[] = $bits[$position - 1];
        }

        return $result;
    }

    /**
     * @param int[] $a
     * @param int[] $b
     * @return int[]
     */
    private function xorBits(array $a, array $b): array
    {
        $result = [];

        foreach ($a as $i => $bit) {
            $result[] = $bit ^ $b[$i];
        }

        return $result;
    }

    /**
     * @param int[] $bytes
     * @return int[]
     */
    private function bytesToBits(array $bytes): array
    {
        $bits = [];

        foreach ($bytes as $byte) {
            for ($i = 7; $i >= 0; $i--) {
                $bits[] = ($byte >> $i) & 1;
            }
        }

        return $bits;
    }

    /**
     * @param int[] $bits
     * @return int[]
     */
    private function bitsToBytes(array $bits): array
    {
        $bytes = [];

        foreach (array_chunk($bits, 8) as $chunk) {
            $byte = 0;

            foreach ($chunk as $bit) {
                $byte = ($byte << 1) | $bit;
            }

            $bytes[] = $byte;
        }

        return $bytes;
    }

    private function stripPkcs7(string $data): ?string
    {
        $padding = ord($data[strlen($data) - 1]);

        if ($padding < 1 || $padding > 8 || $padding > strlen($data)) {
            return null;
        }

        if (substr($data, -$padding) !== str_repeat(chr($padding), $padding)) {
            return null;
        }

        return substr($data, 0, -$padding);
    }
}
