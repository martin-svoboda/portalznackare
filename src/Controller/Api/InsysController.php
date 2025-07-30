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
            $exportDir = $this->getParameter('kernel.project_dir') . '/var/mock-data/api/insys/prikazy/' . $year;
            $filesystem->mkdir($exportDir);
            
            $prikazyFilepath = $exportDir . '/' . $year . '.json';
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
                        $detailDir = $this->getParameter('kernel.project_dir') . '/var/mock-data/api/insys/prikaz/' . $id;
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
            
            // Vytvořit strukturu složek podle endpointu
            $filesystem = new Filesystem();
            
            // Převést endpoint na cestu (např. /api/insys/prikazy -> api/insys/prikazy)
            $endpointPath = trim($endpoint, '/');
            
            // Nahradit path parametry skutečnými hodnotami
            $endpointPath = $this->replacePathParams($endpointPath, $params);
            
            // Vytvořit složku
            $exportDir = $this->getParameter('kernel.project_dir') . '/var/mock-data/' . $endpointPath;
            $filesystem->mkdir($exportDir);
            
            // Název souboru podle typu endpointu
            $filename = $this->generateFilename($endpoint, $params);
            
            $filepath = $exportDir . '/' . $filename;
            file_put_contents($filepath, json_encode($responseData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            return new BinaryFileResponse($filepath, 200, [
                'Content-Type' => 'application/json',
                'Content-Disposition' => sprintf('attachment; filename="%s"', $filename)
            ]);
            
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function replacePathParams(string $path, array $params): string
    {
        // Nahradit {param} skutečnými hodnotami
        foreach ($params as $key => $value) {
            $path = str_replace('{' . $key . '}', $value, $path);
        }
        
        return $path;
    }
    
    private function generateFilename(string $endpoint, array $params): string
    {
        // Pro endpointy bez parametrů použít default název
        if (!str_contains($endpoint, '{')) {
            return 'data.json';
        }
        
        // Pro endpointy s parametry použít poslední parametr jako název
        if (preg_match_all('/\{(\w+)\}/', $endpoint, $matches)) {
            $lastParam = end($matches[1]);
            if (isset($params[$lastParam])) {
                return $params[$lastParam] . '.json';
            }
        }
        
        // Fallback
        return 'data-' . date('Y-m-d-His') . '.json';
    }
}