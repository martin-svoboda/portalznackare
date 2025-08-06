<?php

namespace App\Service;

/**
 * Service pro generování XML dat pro INSYZ API
 */
class XmlGenerationService
{
    /**
     * Generuje XML z dat hlášení pro INSYZ API
     */
    public function generateReportXml(array $reportData): string
    {
        $xml = new \DOMDocument('1.0', 'UTF-8');
        $xml->formatOutput = true;
        
        // Root element s id_zp a cislo_zp jako atributy
        $root = $xml->createElement('ZP');
        
        // Nastavit základní atributy root elementu
        if (isset($reportData['id_zp'])) {
            $root->setAttribute('id_zp', (string)$reportData['id_zp']);
        }
        if (isset($reportData['cislo_zp'])) {
            $root->setAttribute('cislo_zp', (string)$reportData['cislo_zp']);
        }
        
        $xml->appendChild($root);
        
        // Přestrukturovat data - odebrání cast_a a cast_b
        $restructuredData = $this->restructureReportData($reportData);
        
        // Odstranit id_zp a cislo_zp z těla, protože jsou už v atributech
        unset($restructuredData['id_zp'], $restructuredData['cislo_zp']);
        
        // Konvertovat celé pole na XML
        $this->arrayToXml($xml, $root, $restructuredData);
        
        return $xml->saveXML();
    }
    
    /**
     * Přestrukturování dat - odebrání cast_a, cast_b wrapperů
     */
    private function restructureReportData(array $reportData): array
    {
        $result = [];
        
        // Zachovat základní údaje
        if (isset($reportData['id_zp'])) $result['id_zp'] = $reportData['id_zp'];
        if (isset($reportData['cislo_zp'])) $result['cislo_zp'] = $reportData['cislo_zp'];
        if (isset($reportData['znackari'])) $result['znackari'] = $reportData['znackari'];
        
        // Přenést obsah data_a přímo do root
        if (isset($reportData['data_a']) && is_array($reportData['data_a'])) {
            foreach ($reportData['data_a'] as $key => $value) {
                $result[$key] = $value;
            }
        }
        
        // Přenést obsah data_b přímo do root
        if (isset($reportData['data_b']) && is_array($reportData['data_b'])) {
            foreach ($reportData['data_b'] as $key => $value) {
                $result[$key] = $value;
            }
        }
        
        // Calculation → Kalkulace
        if (isset($reportData['calculation'])) {
            $result['Kalkulace'] = $reportData['calculation'];
        }
        
        return $result;
    }
    
    /**
     * Speciální případy pro názvy elementů a objekty s ID
     */
    private function getSpecialCases(): array
    {
        return [
            'Stavy_Tim' => ['element' => 'TIM', 'idField' => null], // klíč je ID
            'Predmety' => ['element' => 'Predmet', 'idField' => null], // klíč je ID
            'znackari' => ['element' => 'Znackar', 'idField' => 'INT_ADR'],
            'Skupiny_Cest' => ['element' => 'Skupina_Cest', 'idField' => 'id'],
            'Cesty' => ['element' => 'Cesta', 'idField' => 'id'],
            'Noclezne' => ['element' => 'Nocleh', 'idField' => 'id'],
            'Vedlejsi_Vydaje' => ['element' => 'Vydaj', 'idField' => 'id'],
            'Prilohy' => ['element' => 'Priloha', 'idField' => 'id'],
            'Prilohy_NP' => ['element' => 'Priloha', 'idField' => 'id'],
            'Prilohy_TIM' => ['element' => 'Priloha', 'idField' => 'id'],
            'Prilohy_Usek' => ['element' => 'Priloha', 'idField' => 'id'],
            'Prilohy_Mapa' => ['element' => 'Priloha', 'idField' => 'id'],
            'Obnovene_Useky' => ['element' => 'Usek', 'idField' => null], // klíč je ID
            'Kalkulace' => ['element' => 'Znackar', 'idField' => null], // klíč je INT_ADR
        ];
    }
    
    /**
     * Speciální transformace pro konkrétní struktury
     */
    private function getSpecialTransformations(): array
    {
        return [
            'Cestujci' => 'transformCestujci',
            'Presmerovani_Vyplat' => 'transformPresmerovaniVyplat',
            'Dny_Prace' => 'transformDnyPrace',
            'Tarif' => 'transformTarif',
        ];
    }
    
    
    /**
     * Rekurzivní konverze pole na XML
     */
    private function arrayToXml(\DOMDocument $xml, \DOMElement $parent, array $data, string $parentKey = ''): void
    {
        $specialCases = $this->getSpecialCases();
        $specialTransformations = $this->getSpecialTransformations();
        
        foreach ($data as $key => $value) {
            if ($value === null || $value === '') {
                continue; // Přeskočit prázdné hodnoty
            }
            
            // Speciální transformace
            if (isset($specialTransformations[$key]) && is_array($value)) {
                $method = $specialTransformations[$key];
                $this->$method($xml, $parent, $key, $value);
                continue;
            }
            
            // Zpracování speciálních případů (pole objektů)
            if (isset($specialCases[$key]) && is_array($value)) {
                $this->processSpecialCase($xml, $parent, $key, $value, $specialCases[$key]);
                continue;
            }
            
            // Pro objekty kde klíč je ID (např. Stavy_Tim -> TIM)
            if (is_numeric($key) === false && is_array($value) && $this->isAssociativeArray($value)) {
                // Zkontroluj, zda parent má speciální případy
                if (isset($specialCases[$parentKey]) && $specialCases[$parentKey]['idField'] === null) {
                    $elementName = $this->sanitizeElementName($specialCases[$parentKey]['element']);
                    $element = $xml->createElement($elementName);
                    
                    // Vyčistit _ prefix z klíče pro ID atribut
                    $cleanKey = ltrim($key, '_');
                    $element->setAttribute('id', $cleanKey);
                    $parent->appendChild($element);
                    
                    // Přeskočit metadata objekty
                    $filteredValue = $this->filterMetadata($value);
                    $this->arrayToXml($xml, $element, $filteredValue);
                    continue;
                }
            }
            
            // Běžné pole nebo hodnota
            if (is_array($value)) {
                $elementName = $this->sanitizeElementName($key);
                $element = $xml->createElement($elementName);
                $parent->appendChild($element);
                $this->arrayToXml($xml, $element, $value, $key);
            } else {
                $elementName = $this->sanitizeElementName($key);
                $element = $xml->createElement($elementName);
                $element->appendChild($xml->createTextNode((string)$value));
                $parent->appendChild($element);
            }
        }
    }
    
    /**
     * Zpracování speciálních případů (pole objektů)
     */
    private function processSpecialCase(\DOMDocument $xml, \DOMElement $parent, string $key, array $items, array $config): void
    {
        $containerName = $this->sanitizeElementName($key);
        $container = $xml->createElement($containerName);
        $parent->appendChild($container);
        
        foreach ($items as $itemKey => $item) {
            if (!is_array($item)) {
                continue;
            }
            
            $elementName = $this->sanitizeElementName($config['element']);
            $element = $xml->createElement($elementName);
            
            // Pokud idField je null, použij klíč jako ID
            if ($config['idField'] === null) {
                // Vyčistit _ prefix z klíče pro ID atribut
                $cleanKey = ltrim($itemKey, '_');
                $element->setAttribute('id', $cleanKey);
            } elseif (isset($item[$config['idField']])) {
                $element->setAttribute('id', (string)$item[$config['idField']]);
            }
            
            $container->appendChild($element);
            
            // Přeskočit metadata objekty
            $filteredItem = $this->filterMetadata($item);
            $this->arrayToXml($xml, $element, $filteredItem, $key);
        }
    }
    
    /**
     * Sanitizace názvu elementu pro XML
     */
    private function sanitizeElementName(string $name): string
    {
        // XML element names musí začínat písmenem nebo podtržítkem
        // a mohou obsahovat pouze písmena, číslice, pomlčky, tečky a podtržítka
        
        // Převést na string (pro případ, že by bylo předáno něco jiného)
        $name = (string)$name;
        
        // Nahradit nepovolené znaky podtržítkem
        $name = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $name);
        
        // Zajistit, že název nezačíná číslicí nebo tečkou/pomlčkou
        if (preg_match('/^[0-9.-]/', $name)) {
            $name = '_' . $name;
        }
        
        // Pokud je název prázdný nebo pouze podtržítka, použít fallback
        if (empty($name) || preg_match('/^_+$/', $name)) {
            $name = 'Element';
        }
        
        return $name;
    }
    
    /**
     * Filtruje metadata objekty z pole
     */
    private function filterMetadata(array $data): array
    {
        return array_filter($data, function($key) {
            return $key !== 'metadata';
        }, ARRAY_FILTER_USE_KEY);
    }
    
    /**
     * Transformace Cestujci pole: _0 -> INT_ADR
     */
    private function transformCestujci(\DOMDocument $xml, \DOMElement $parent, string $key, array $data): void
    {
        $element = $xml->createElement($key);
        $parent->appendChild($element);
        
        foreach ($data as $index => $intAdr) {
            $cestujciElement = $xml->createElement('INT_ADR');
            $cestujciElement->appendChild($xml->createTextNode((string)$intAdr));
            $element->appendChild($cestujciElement);
        }
    }
    
    /**
     * Transformace Presmerovani_Vyplat: _4457 -> <Vyplatit INT_ADR="4457">
     */
    private function transformPresmerovaniVyplat(\DOMDocument $xml, \DOMElement $parent, string $key, array $data): void
    {
        $element = $xml->createElement($key);
        $parent->appendChild($element);
        
        foreach ($data as $fromIntAdr => $toIntAdr) {
            // Odstranit _ prefix pokud existuje
            $cleanFromIntAdr = ltrim($fromIntAdr, '_');
            
            $vyplatitElement = $xml->createElement('Vyplatit');
            $vyplatitElement->setAttribute('INT_ADR', $cleanFromIntAdr);
            $vyplatitElement->appendChild($xml->createTextNode((string)$toIntAdr));
            $element->appendChild($vyplatitElement);
        }
    }
    
    /**
     * Transformace Dny_Prace: _0 -> Den
     */
    private function transformDnyPrace(\DOMDocument $xml, \DOMElement $parent, string $key, array $data): void
    {
        $element = $xml->createElement($key);
        $parent->appendChild($element);
        
        foreach ($data as $index => $den) {
            if (is_array($den)) {
                $denElement = $xml->createElement('Den');
                $element->appendChild($denElement);
                $this->arrayToXml($xml, $denElement, $den);
            }
        }
    }
    
    /**
     * Transformace Tarif: jako obyčejný element
     */
    private function transformTarif(\DOMDocument $xml, \DOMElement $parent, string $key, array $data): void
    {
        $element = $xml->createElement($key);
        $parent->appendChild($element);
        
        $this->arrayToXml($xml, $element, $data);
    }
    
    
    /**
     * Kontrola, zda je pole asociativní (má stringové klíče)
     */
    private function isAssociativeArray(array $array): bool
    {
        if (empty($array)) {
            return false;
        }
        return array_keys($array) !== range(0, count($array) - 1);
    }
}