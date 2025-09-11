<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Service\FileUploadService;
use App\Service\ImageProcessingService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\Exception\FileException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/portal/files')]
class FileController extends AbstractController
{
    public function __construct(
        private FileUploadService $fileUploadService,
        private ImageProcessingService $imageProcessingService,
        private ValidatorInterface $validator
    ) {
    }

    #[Route('/upload', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        try {
            $user = $this->getUser();
            if (!$user instanceof User) {
                error_log("FileController::upload - Uživatel není přihlášený");
                return new JsonResponse([
                    'error' => 'Nepřihlášený uživatel'
                ], Response::HTTP_UNAUTHORIZED);
            }

            error_log("FileController::upload - Uživatel: " . $user->getJmeno() . " " . $user->getPrijmeni() . " (ID: " . $user->getIntAdr() . ")");

            $files = $request->files->get('files');
            if (!$files) {
                error_log("FileController::upload - Žádné soubory k nahrání");
                return new JsonResponse([
                    'error' => 'Žádné soubory k nahrání'
                ], Response::HTTP_BAD_REQUEST);
            }

            // Convert single file to array
            if (!is_array($files)) {
                $files = [$files];
            }

            error_log("FileController::upload - Počet souborů k nahrání: " . count($files));

            $storagePath = $request->request->get('path');
            $options = json_decode($request->request->get('options', '{}'), true);
            
            error_log("FileController::upload - Storage path: " . ($storagePath ?: 'null'));
            error_log("FileController::upload - Options: " . json_encode($options));
            
            // Add is_public parameter from request
            if ($request->request->has('is_public')) {
                $options['is_public'] = $request->request->getBoolean('is_public');
            }
            
            // Add entity type and ID for usage tracking
            $controllerDebug = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'FileController::upload',
                'has_entity_type' => $request->request->has('entity_type'),
                'has_entity_id' => $request->request->has('entity_id'),
                'has_field_name' => $request->request->has('field_name'),
                'entity_type_value' => $request->request->get('entity_type'),
                'entity_id_value' => $request->request->get('entity_id'),
                'field_name_value' => $request->request->get('field_name')
            ];
            file_put_contents($this->getParameter('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($controllerDebug) . "\n", FILE_APPEND);
            
            if ($request->request->has('entity_type')) {
                $options['entity_type'] = $request->request->get('entity_type');
            }
            if ($request->request->has('entity_id')) {
                $options['entity_id'] = (int)$request->request->get('entity_id');
            }
            if ($request->request->has('field_name')) {
                $options['field_name'] = $request->request->get('field_name');
            }
            
            $controllerDebug2 = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'FileController::upload',
                'final_options' => $options
            ];
            file_put_contents($this->getParameter('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($controllerDebug2) . "\n", FILE_APPEND);

            $uploadedFiles = [];
            $errors = [];

            foreach ($files as $index => $file) {
                error_log("FileController::upload - Zpracovávám soubor #$index: " . $file->getClientOriginalName() . " (" . $file->getSize() . " bytes)");
                
                // Validate file
                $constraints = new Assert\File([
                    'maxSize' => '15M',
                    'mimeTypes' => [
                        'image/jpeg',
                        'image/png',
                        'image/heic',
                        'image/heif',
                        'application/pdf',
                    ],
                    'mimeTypesMessage' => 'Povolené formáty: JPEG, PNG, HEIC, PDF',
                ]);

                $violations = $this->validator->validate($file, $constraints);
                
                if (count($violations) > 0) {
                    $errorMsg = $violations[0]->getMessage();
                    error_log("FileController::upload - Validační chyba pro soubor " . $file->getClientOriginalName() . ": " . $errorMsg);
                    $errors[] = [
                        'file' => $file->getClientOriginalName(),
                        'error' => $errorMsg
                    ];
                    continue;
                }

                try {
                    error_log("FileController::upload - Volám uploadFile pro: " . $file->getClientOriginalName());
                    
                    $attachment = $this->fileUploadService->uploadFile(
                        $file,
                        $user,
                        $storagePath,
                        $options
                    );

                    error_log("FileController::upload - Úspěšně nahráno: " . $attachment->getOriginalName() . " (ID: " . $attachment->getId() . ")");

                    $uploadedFiles[] = [
                        'id' => $attachment->getId(),
                        'fileName' => $attachment->getOriginalName(),
                        'fileSize' => $attachment->getSize(),
                        'fileType' => $attachment->getMimeType(),
                        'url' => $attachment->getPublicUrl(),
                        'uploadedAt' => $attachment->getCreatedAt()->format('c'),
                        'uploadedBy' => $user->getJmeno() . ' ' . $user->getPrijmeni(),
                        'metadata' => $attachment->getMetadata(),
                        'isPublic' => $attachment->isPublic(),
                    ];
                } catch (FileException $e) {
                    $errorMsg = 'Chyba při ukládání souboru: ' . $e->getMessage();
                    error_log("FileController::upload - FileException pro " . $file->getClientOriginalName() . ": " . $e->getMessage());
                    error_log("FileController::upload - FileException trace: " . $e->getTraceAsString());
                    $errors[] = [
                        'file' => $file->getClientOriginalName(),
                        'error' => $errorMsg
                    ];
                } catch (\Exception $e) {
                    $errorMsg = 'Neočekávaná chyba: ' . $e->getMessage();
                    error_log("FileController::upload - Exception pro " . $file->getClientOriginalName() . ": " . $e->getMessage());
                    error_log("FileController::upload - Exception trace: " . $e->getTraceAsString());
                    $errors[] = [
                        'file' => $file->getClientOriginalName(),
                        'error' => $errorMsg
                    ];
                }
            }

            error_log("FileController::upload - Výsledek: " . count($uploadedFiles) . " úspěšných, " . count($errors) . " chyb");
            
            return new JsonResponse([
                'success' => count($uploadedFiles) > 0,
                'files' => $uploadedFiles,
                'errors' => $errors
            ]);
            
        } catch (\Exception $e) {
            error_log("FileController::upload - Fatální chyba: " . $e->getMessage());
            error_log("FileController::upload - Fatální chyba trace: " . $e->getTraceAsString());
            
            return new JsonResponse([
                'error' => 'Fatální chyba při uploadu: ' . $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile() . ':' . $e->getLine()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/{id}', methods: ['GET'])]
    public function getFile(int $id): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $file = $this->fileUploadService->getFile($id, $user);
        
        if (!$file) {
            return new JsonResponse([
                'error' => 'Soubor nenalezen'
            ], Response::HTTP_NOT_FOUND);
        }

        return new JsonResponse([
            'id' => $file->getId(),
            'fileName' => $file->getOriginalName(),
            'fileSize' => $file->getSize(),
            'fileType' => $file->getMimeType(),
            'url' => $file->getPublicUrl(),
            'uploadedAt' => $file->getCreatedAt()->format('c'),
            'metadata' => $file->getMetadata(),
        ]);
    }

    #[Route('/{id}', methods: ['DELETE'])]
    public function deleteFile(int $id, Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $file = $this->fileUploadService->getFile($id, $user);
        
        if (!$file) {
            // Případ 2&3: Soubor není v databázi - ale možná máme entity context pro cleanup
            $requestData = json_decode($request->getContent(), true) ?? [];
            $entityType = $requestData['entity_type'] ?? null;
            $entityId = $requestData['entity_id'] ?? null;
            
            if ($entityType && $entityId) {
                // Cleanup orphaned reference from entity
                $cleanupResult = $this->fileUploadService->cleanupOrphanedReference($id, $entityType, (int)$entityId);
                
                if ($cleanupResult) {
                    return new JsonResponse([
                        'success' => true,
                        'message' => 'Neexistující soubor byl odebrán z formuláře'
                    ]);
                }
            }
            
            return new JsonResponse([
                'error' => 'Soubor nebyl nalezen v databázi'
            ], Response::HTTP_NOT_FOUND);
        }

        // Check if user can delete (uploaded by them or they are admin)
        if ((int)$file->getUploadedBy() !== (int)$user->getIntAdr() && !$this->isGranted('ROLE_ADMIN')) {
            return new JsonResponse([
                'error' => 'Nemáte oprávnění smazat tento soubor'
            ], Response::HTTP_FORBIDDEN);
        }

        try {
            $requestData = json_decode($request->getContent(), true) ?? [];
            $forceDelete = $requestData['force'] ?? $request->query->getBoolean('force', false);
            $entityType = $requestData['entity_type'] ?? null;
            $entityId = $requestData['entity_id'] ?? null;
            $fieldName = $requestData['field_name'] ?? null;
            
            // Validate admin force delete permission
            if ($forceDelete && !$this->isGranted('ROLE_ADMIN')) {
                return new JsonResponse([
                    'error' => 'Pouze administrátor může vynutit smazání souboru'
                ], Response::HTTP_FORBIDDEN);
            }
            
            if ($entityType && $entityId) {
                // Případ 1: Check if physical file exists
                $physicalFileExists = $this->fileUploadService->physicalFileExists($file);
                
                if (!$physicalFileExists) {
                    // Orphaned file - remove usage and clean up DB if no more usage
                    $file = $this->fileUploadService->removeFileUsage($file->getId(), $entityType, (int)$entityId, $fieldName);
                    
                    if (!$file) {
                        return new JsonResponse([
                            'error' => 'Chyba při odebírání použití souboru'
                        ], Response::HTTP_INTERNAL_SERVER_ERROR);
                    }
                    
                    if ($file->getUsageCount() === 0) {
                        // No more usage - clean up all references and remove DB record
                        $this->fileUploadService->cleanupAllEntityReferences($file);
                        $this->fileUploadService->removeFromDatabase($file);
                        $message = 'Odkaz na neexistující soubor byl odstraněn';
                    } else {
                        $message = 'Použití souboru bylo odebráno';
                    }
                    
                    $response = [
                        'success' => true,
                        'message' => $message
                    ];
                } else {
                    // Normal case - physical file exists
                    $file = $this->fileUploadService->removeFileUsage($file->getId(), $entityType, (int)$entityId, $fieldName);
                    
                    if (!$file) {
                        return new JsonResponse([
                            'error' => 'Chyba při odebírání použití souboru'
                        ], Response::HTTP_INTERNAL_SERVER_ERROR);
                    }
                    
                    // Check if file has remaining usage
                    if ($file->getUsageCount() > 0) {
                        $response = [
                            'success' => true,
                            'message' => 'Použití souboru bylo odebráno'
                        ];
                    } else {
                        // No more usage - decide force vs soft delete
                        if ($forceDelete || $this->fileUploadService->shouldAutoForceDelete($file)) {
                            $this->fileUploadService->physicallyDeleteFile($file);
                            $message = 'Soubor byl fyzicky smazán';
                        } else {
                            $this->fileUploadService->softDeleteFile($file);
                            $message = 'Soubor byl přesunut do koše';
                        }
                        
                        $response = [
                            'success' => true,
                            'message' => $message
                        ];
                    }
                }
            } else {
                // Fallback - delete entire file (legacy behavior)
                $this->fileUploadService->deleteFile($file, $forceDelete);
                $response = [
                    'success' => true,
                    'message' => 'Soubor byl úspěšně smazán'
                ];
            }
            
            return new JsonResponse($response);
        } catch (\Exception $e) {
            error_log(sprintf(
                "File deletion failed - File ID: %d, User: %s, Error: %s",
                $file->getId(),
                $user->getIntAdr(),
                $e->getMessage()
            ));
            
            return new JsonResponse([
                'error' => 'Chyba při mazání souboru',
                'details' => $e->getMessage(),
                'file_id' => $file->getId()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/usage', methods: ['POST'])]
    public function addUsage(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['fileId']) || !isset($data['type']) || !isset($data['id'])) {
            return new JsonResponse([
                'error' => 'Chybí povinné parametry (fileId, type, id)'
            ], Response::HTTP_BAD_REQUEST);
        }

        $file = $this->fileUploadService->addFileUsage(
            (int)$data['fileId'],
            $data['type'],
            (int)$data['id'],
            $data['data'] ?? null,
            $data['field_name'] ?? null
        );

        if (!$file) {
            return new JsonResponse([
                'error' => 'Soubor nenalezen'
            ], Response::HTTP_NOT_FOUND);
        }

        return new JsonResponse([
            'success' => true,
            'file' => [
                'id' => $file->getId(),
                'usageCount' => $file->getUsageCount(),
                'isTemporary' => $file->isTemporary()
            ]
        ]);
    }

    #[Route('/usage', methods: ['DELETE'])]
    public function removeUsage(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['fileId']) || !isset($data['type']) || !isset($data['id'])) {
            return new JsonResponse([
                'error' => 'Chybí povinné parametry (fileId, type, id)'
            ], Response::HTTP_BAD_REQUEST);
        }

        $file = $this->fileUploadService->removeFileUsage(
            (int)$data['fileId'],
            $data['type'],
            (int)$data['id'],
            $data['field_name'] ?? null
        );

        if (!$file) {
            return new JsonResponse([
                'error' => 'Soubor nenalezen'
            ], Response::HTTP_NOT_FOUND);
        }

        return new JsonResponse([
            'success' => true,
            'file' => [
                'id' => $file->getId(),
                'usageCount' => $file->getUsageCount(),
                'isTemporary' => $file->isTemporary()
            ]
        ]);
    }

    #[Route('/orphaned-references', methods: ['GET'])]
    public function getOrphanedReferences(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Only admins can see orphaned references
        if (!$this->isGranted('ROLE_ADMIN')) {
            return new JsonResponse([
                'error' => 'Nedostatečná oprávnění'
            ], Response::HTTP_FORBIDDEN);
        }

        try {
            $orphanedReferences = $this->fileUploadService->findPotentialOrphanedReferences();
            
            return new JsonResponse([
                'success' => true,
                'orphanedReferences' => $orphanedReferences,
                'count' => count($orphanedReferences)
            ]);
        } catch (\Exception $e) {
            error_log(sprintf(
                "Failed to get orphaned references - User: %s, Error: %s",
                $user->getIntAdr(),
                $e->getMessage()
            ));
            
            return new JsonResponse([
                'error' => 'Chyba při načítání orphaned odkazů',
                'details' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/{id}/edit', methods: ['PUT'])]
    public function edit(int $id, Request $request): JsonResponse
    {
        try {
            $user = $this->getUser();
            if (!$user instanceof User) {
                return new JsonResponse([
                    'error' => 'Neautorizovaný přístup'
                ], Response::HTTP_UNAUTHORIZED);
            }

            // Najít soubor
            $file = $this->fileUploadService->getFile($id, $user);
            if (!$file) {
                return new JsonResponse([
                    'error' => 'Soubor nebyl nalezen'
                ], Response::HTTP_NOT_FOUND);
            }

            // Kontrola oprávnění - pouze vlastník nebo admin
            if ((int)$file->getUploadedBy() !== (int)$user->getIntAdr() && !$this->isGranted('ROLE_ADMIN')) {
                return new JsonResponse([
                    'error' => 'Nemáte oprávnění editovat tento soubor'
                ], Response::HTTP_FORBIDDEN);
            }

            // Pouze obrázky lze editovat
            if (!str_starts_with($file->getMimeType(), 'image/')) {
                return new JsonResponse([
                    'error' => 'Lze editovat pouze obrázky'
                ], Response::HTTP_BAD_REQUEST);
            }

            // Parse request data
            $data = json_decode($request->getContent(), true);
            if (!$data) {
                return new JsonResponse([
                    'error' => 'Neplatná data požadavku'
                ], Response::HTTP_BAD_REQUEST);
            }

            $operations = $data['operations'] ?? [];
            $saveMode = $data['saveMode'] ?? 'overwrite'; // 'overwrite' | 'copy'
            
            // Usage tracking parametry (stejné jako u upload/delete)
            $entityType = $data['entity_type'] ?? null;
            $entityId = $data['entity_id'] ?? null;
            $fieldName = $data['field_name'] ?? null;

            if (empty($operations)) {
                return new JsonResponse([
                    'error' => 'Žádné editační operace nebyly specifikovány'
                ], Response::HTTP_BAD_REQUEST);
            }

            // Zpracovat operace s usage parametry
            $editedFile = $this->imageProcessingService->processOperations(
                $file, 
                $operations, 
                $saveMode,
                $entityType,
                $entityId,
                $fieldName
            );
            
            return new JsonResponse([
                'success' => true,
                'message' => 'Soubor byl úspěšně upraven',
                'file' => [
                    'id' => $editedFile->getId(),
                    'fileName' => $editedFile->getOriginalName(),
                    'fileSize' => $editedFile->getSize(),
                    'fileType' => $editedFile->getMimeType(),
                    'url' => '/uploads/' . $editedFile->getPath(),
                    'thumbnailUrl' => $editedFile->getThumbnailPath() ? '/uploads/' . $editedFile->getThumbnailPath() : null,
                    'uploadedAt' => $editedFile->getCreatedAt() ? $editedFile->getCreatedAt()->format('c') : (new \DateTime())->format('c'),
                    'isEdited' => true,
                    'isNewFile' => $saveMode === 'copy', // Indikátor pro frontend
                    'operations' => $operations,
                    'saveMode' => $saveMode
                ]
            ]);

        } catch (\Exception $e) {
            error_log("FileController::edit - Chyba: " . $e->getMessage());
            
            return new JsonResponse([
                'error' => 'Nepodařilo se editovat soubor',
                'details' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}