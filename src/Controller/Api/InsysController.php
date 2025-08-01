<?php

namespace App\Controller\Api;

use App\Service\InsysService;
use App\Service\DataEnricherService;
use App\Entity\User;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

#[Route('/api/insys')]
class InsysController extends AbstractController
{
    public function __construct(
        private InsysService $insysService,
        private DataEnricherService $dataEnricher
    ) {
    }

    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['email']) || !isset($data['hash'])) {
            return new JsonResponse(['message' => 'Vyžadované parametry: email, hash'], 400);
        }

        try {
            $intAdr = $this->insysService->loginUser($data['email'], $data['hash']);
            
            return new JsonResponse([
                'success' => true,
                'int_adr' => $intAdr
            ]);
        } catch (Exception $e) {
            return new JsonResponse(['message' => $e->getMessage()], 401);
        }
    }

    #[Route('/user', methods: ['GET'])]
    public function getInsysUser(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $intAdr = $user->getIntAdr();

        try {
            $userData = $this->insysService->getUser((int) $intAdr);
            
            return new JsonResponse($userData);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/prikazy', methods: ['GET'])]
    public function getPrikazy(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $year = $request->query->get('year');
        $intAdr = $user->getIntAdr();

        try {
            $prikazy = $this->insysService->getPrikazy((int) $intAdr, $year ? (int) $year : null);
            
            // Obohatí data pouze pokud není raw parameter
            $raw = $request->query->get('raw');
            if (!$raw) {
                $prikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
            }
            
            return new JsonResponse($prikazy);
        } catch (Exception $e) {
            return new JsonResponse(['message' => $e->getMessage()], 500);
        }
    }

    #[Route('/prikaz/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getPrikaz(int $id, Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $intAdr = $user->getIntAdr();

        try {
            $prikaz = $this->insysService->getPrikaz((int) $intAdr, $id);
            
            // Obohatí detail pouze pokud není raw parameter
            $raw = $request->query->get('raw');
            if (!$raw) {
                $prikaz = $this->dataEnricher->enrichPrikazDetail($prikaz);
            }
            
            return new JsonResponse($prikaz);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/ceniky', methods: ['GET'])]
    public function getCeniky(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $date = $request->query->get('date');
        
        try {
            // Mock data pro ceníky - v produkci by se načítalo z INSYS
            $ceniky = [
                'jizdne' => 6,
                'jizdneZvysene' => 8,
                'tarifDobaOd1' => 0,
                'tarifDobaDo1' => 4,
                'tarifStravne1' => 0,
                'tarifNahrada1' => 0,
                'tarifDobaOd2' => 4,
                'tarifDobaDo2' => 5,
                'tarifStravne2' => 0,
                'tarifNahrada2' => 150,
                'tarifDobaOd3' => 5,
                'tarifDobaDo3' => 8,
                'tarifStravne3' => 160,
                'tarifNahrada3' => 150,
                'tarifDobaOd4' => 8,
                'tarifDobaDo4' => 12,
                'tarifStravne4' => 160,
                'tarifNahrada4' => 300,
                'tarifDobaOd5' => 12,
                'tarifDobaDo5' => 18,
                'tarifStravne5' => 250,
                'tarifNahrada5' => 300,
                'tarifDobaOd6' => 18,
                'tarifDobaDo6' => 24,
                'tarifStravne6' => 390,
                'tarifNahrada6' => 300,
                'date' => $date ?: date('Y-m-d')
            ];
            
            return new JsonResponse($ceniky);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/export/batch-prikazy', methods: ['POST'])]
    public function exportBatchPrikazy(Request $request): JsonResponse
    {
        // Povolit pouze v dev prostředí
        if ($this->getParameter('kernel.environment') !== 'dev') {
            return new JsonResponse(['error' => 'Export je dostupný pouze ve vývojovém prostředí'], 403);
        }

        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Nepřihlášený uživatel'], 401);
        }

        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['prikazy']) || !isset($data['year'])) {
            return new JsonResponse(['error' => 'Vyžadované parametry: prikazy, year'], 400);
        }

        try {
            $intAdr = (int) $user->getIntAdr();
            $prikazy = $data['prikazy'];
            $year = $data['year'];
            $exported = [];
            
            // Export seznamu příkazů
            $filesystem = new Filesystem();
            $exportDir = $this->getParameter('kernel.project_dir') . '/var/mock-data/api/insys/prikazy';
            $filesystem->mkdir($exportDir);
            
            $prikazyFilepath = $exportDir . '/' . $intAdr . '-' . $year . '.json';
            file_put_contents($prikazyFilepath, json_encode($prikazy, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $exported[] = 'Seznam příkazů ' . $year;
            
            // Export detailů jednotlivých příkazů
            $detailsExported = 0;
            foreach ($prikazy as $prikaz) {
                if (isset($prikaz['ID_Znackarske_Prikazy'])) {
                    $id = $prikaz['ID_Znackarske_Prikazy'];
                    
                    try {
                        // Načíst detail příkazu (surová data)
                        $detail = $this->insysService->getPrikaz($intAdr, $id);
                        
                        // Uložit detail
                        $detailDir = $this->getParameter('kernel.project_dir') . '/var/mock-data/api/insys/prikaz';
                        $filesystem->mkdir($detailDir);
                        
                        $detailFilepath = $detailDir . '/' . $id . '.json';
                        file_put_contents($detailFilepath, json_encode($detail, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                        
                        $detailsExported++;
                    } catch (Exception $e) {
                        // Pokračovat i při chybě u jednotlivého příkazu
                        continue;
                    }
                }
            }
            
            $exported[] = sprintf('Detaily %d příkazů', $detailsExported);
            
            // Uložit metadata
            $metadata = [
                'exported_at' => date('Y-m-d H:i:s'),
                'environment' => $this->getParameter('kernel.environment'),
                'user_int_adr' => $intAdr,
                'year' => $year,
                'total_prikazy' => count($prikazy),
                'exported_details' => $detailsExported,
                'exported_items' => $exported
            ];
            
            $metadataDir = $this->getParameter('kernel.project_dir') . '/var/mock-data';
            $metadataFile = $metadataDir . '/batch-export-metadata-' . date('Y-m-d-His') . '.json';
            file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            return new JsonResponse([
                'success' => true,
                'message' => sprintf('Exportováno %d příkazů a %d detailů', count($prikazy), $detailsExported),
                'exported' => $exported,
                'metadata_file' => basename($metadataFile)
            ]);
            
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Univerzální export endpoint pro dev prostředí
     */
    
    #[Route('/export', methods: ['POST'])]
    public function exportData(Request $request): JsonResponse|BinaryFileResponse
    {
        // Povolit pouze v dev prostředí
        if ($this->getParameter('kernel.environment') !== 'dev') {
            return new JsonResponse(['error' => 'Export je dostupný pouze ve vývojovém prostředí'], 403);
        }

        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['endpoint']) || !isset($data['response'])) {
            return new JsonResponse(['error' => 'Vyžadované parametry: endpoint, response'], 400);
        }

        try {
            $endpoint = $data['endpoint'];
            $responseData = $data['response'];
            $params = $data['params'] ?? [];
            
            // Vytvořit strukturu složek a název souboru
            $pathInfo = $this->determineExportPathFromData($endpoint, $params, $responseData);
            
            $filesystem = new Filesystem();
            $exportDir = $this->getParameter('kernel.project_dir') . '/var/mock-data/' . $pathInfo['dir'];
            $filesystem->mkdir($exportDir);
            
            $filepath = $exportDir . '/' . $pathInfo['filename'];
            file_put_contents($filepath, json_encode($responseData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            return new JsonResponse([
                'success' => true,
                'message' => 'Data byla úspěšně uložena na server',
                'filename' => $pathInfo['filename'],
                'path' => 'var/mock-data/' . $pathInfo['dir'] . '/' . $pathInfo['filename']
            ]);
            
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function determineExportPathFromData(string $endpoint, array $params, array $responseData): array
    {
        // Převést endpoint na základní cestu
        $basePath = trim($endpoint, '/');
        
        // Rozpoznat typ endpointu a určit správnou strukturu
        if (str_contains($endpoint, '/user')) {
            // Pro user endpoint - získat INT_ADR z response dat
            $intAdr = $this->extractFromResponse($responseData, ['INT_ADR', 'int_adr', 'intAdr']);
            return [
                'dir' => 'api/insys/user',
                'filename' => ($intAdr ?: 'data') . '.json'
            ];
        }
        
        if (str_contains($endpoint, '/prikazy')) {
            // Pro příkazy endpoint - jeden soubor na uživatele a rok
            $intAdr = $this->getUser()?->getIntAdr() ?? 'unknown';
            $year = $params['year'] ?? date('Y');
            return [
                'dir' => 'api/insys/prikazy',
                'filename' => $intAdr . '-' . $year . '.json'
            ];
        }
        
        if (str_contains($endpoint, '/prikaz/') && !str_contains($endpoint, '/prikazy')) {
            // Pro detail příkazu - jeden soubor na příkaz
            $id = $params['id'] ?? $this->extractFromResponse($responseData, ['ID_Znackarske_Prikazy', 'id', 'ID']);
            return [
                'dir' => 'api/insys/prikaz',
                'filename' => ($id ?: 'data') . '.json'
            ];
        }
        
        if (str_contains($endpoint, '/ceniky')) {
            return [
                'dir' => 'api/insys/ceniky',
                'filename' => 'ceniky-' . date('Y-m-d') . '.json'
            ];
        }
        
        // Default pro neznámé endpointy
        $cleanPath = preg_replace('/\{[^}]+\}/', '', $basePath); // odstranit {parametry}
        $cleanPath = trim($cleanPath, '/');
        
        return [
            'dir' => $cleanPath,
            'filename' => 'data-' . date('Y-m-d-His') . '.json'
        ];
    }
    
    private function extractFromResponse(array $data, array $possibleKeys): ?string
    {
        // Pokud je response array objektů, vezmi první
        if (isset($data[0]) && is_array($data[0])) {
            $data = $data[0];
        }
        
        // Pokud je response objekt s head/data strukturou
        if (isset($data['head']) && is_array($data['head'])) {
            $data = $data['head'];
        }
        
        // Hledej hodnotu podle možných klíčů
        foreach ($possibleKeys as $key) {
            if (isset($data[$key])) {
                return (string)$data[$key];
            }
        }
        
        return null;
    }
}