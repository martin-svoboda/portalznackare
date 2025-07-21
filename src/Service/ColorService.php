<?php

namespace App\Service;

/**
 * Služba pro zpracování barev značek a přesunů
 * Port z WP-src/portal/shared/colors.ts
 */
class ColorService
{
    /**
     * Vrátí barvu podle typu přesunu
     */
    public function barvaDlePresunu(?string $val): string
    {
        if (!$val) {
            return '#ffffff';
        }
        
        $v = strtoupper(trim($val));
        
        return match($v) {
            'PZT' => '#ffffff',  // bílá (RAL 1013 - perlová bílá)
            'LZT' => '#f7951d',  // oranžová (RAL 2009 - dopravní oranžová)
            'CZT', 'CZS' => '#ffe000',  // žlutá (RAL 1003 - signální žlutá)
            default => '#ffffff'  // fallback (bílá)
        };
    }

    /**
     * Vrátí barvu podle kódu barvy
     */
    public function barvaDleKodu(?string $val): string
    {
        if (!$val) {
            return '#cccccc';
        }
        
        $v = strtoupper(trim($val));
        
        return match($v) {
            'CE' => '#e50313',   // RAL 3020 (červená signální)
            'MO' => '#1a6dff',   // RAL 5015 (modrá nebeská)
            'ZE' => '#009C00',   // RAL 6024 (zelená dopravní)
            'ZL' => '#ffdd00',   // RAL 1003 (žlutá signální)
            'BI' => '#ffffff',   // RAL 1013 (bílá perlová)
            'KH' => '#6A5F31',   // RAL 7008 (Khaki Gray)
            'BE' => 'transparent', // bezbarvá
            'XX' => 'transparent', // nerozlišeno
            'CA' => '#000000',   // černá
            default => '#cccccc' // fallback šedá
        };
    }

    /**
     * Vrátí Tailwind CSS třídu pro barvu
     */
    public function tailwindClassDleKodu(?string $val): string
    {
        if (!$val) {
            return 'bg-gray-300';
        }
        
        $v = strtoupper(trim($val));
        
        return match($v) {
            'CE' => 'bg-red-500',
            'MO' => 'bg-blue-500', 
            'ZE' => 'bg-green-500',
            'ZL' => 'bg-yellow-400',
            'BI' => 'bg-white',
            'KH' => 'bg-amber-700',
            'BE' => 'bg-transparent',
            'XX' => 'bg-transparent', 
            'CA' => 'bg-black',
            default => 'bg-gray-300'
        };
    }

    /**
     * Vrátí název barvy
     */
    public function nazevBarvy(?string $val): string
    {
        if (!$val) {
            return 'neznámá';
        }
        
        $v = strtoupper(trim($val));
        
        return match($v) {
            'CE' => 'červená',
            'MO' => 'modrá',
            'ZE' => 'zelená', 
            'ZL' => 'žlutá',
            'BI' => 'bílá',
            'KH' => 'khaki',
            'BE' => 'bezbarvá',
            'XX' => 'nerozlišeno',
            'CA' => 'černá',
            default => 'neznámá'
        };
    }
}