<?php

namespace App\Service;

use Granam\CzechVocative\CzechName;

/**
 * Služba pro české skloňování jmen do 5. pádu (vokativ)
 * Používá knihovnu granam/czech-vocative
 */
class CzechVocativeService {
    
    /**
     * Převede jméno do 5. pádu (vokativ) pro oslovení
     * 
     * @param string $name Jméno v 1. pádu
     * @return string Jméno v 5. pádu pro oslovení
     */
    public function toVocative(string $name): string {
        if (empty(trim($name))) {
            return $name;
        }
        
        try {
            $czechName = new CzechName();
            return $czechName->vocative($name);
        } catch (\Exception $e) {
            // Pokud se nepodaří skloňovat (například cizí jména), vrátíme původní
            return $name;
        }
    }
    
    /**
     * Vytvoří oslovení s předponou
     * 
     * @param string $name Jméno v 1. pádu
     * @param string $prefix Předpona (např. "Dobrý den", "Ahoj")
     * @return string Kompletní oslovení
     */
    public function createGreeting(string $name, string $prefix = 'Dobrý den'): string {
        if (empty(trim($name))) {
            return $prefix;
        }
        
        $vocativeName = $this->toVocative($name);
        return $prefix . ', ' . $vocativeName;
    }
    
    /**
     * Vytvoří oslovení podle času dne
     * 
     * @param string $name Jméno v 1. pádu
     * @return string Oslovení podle času
     */
    public function createTimeBasedGreeting(string $name): string {
        $hour = (int) date('H');
        
        if ($hour >= 5 && $hour < 10) {
            $greeting = 'Dobré ráno';
        } elseif ($hour >= 10 && $hour < 18) {
            $greeting = 'Dobrý den';
        } elseif ($hour >= 18 && $hour < 22) {
            $greeting = 'Dobrý večer';
        } else {
            $greeting = 'Dobrou noc';
        }
        
        return $this->createGreeting($name, $greeting);
    }
}