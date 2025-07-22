<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Service\FileUploadService;
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
        private ValidatorInterface $validator
    ) {
    }

    #[Route('/upload', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $files = $request->files->get('files');
        if (!$files) {
            return new JsonResponse([
                'error' => 'Žádné soubory k nahrání'
            ], Response::HTTP_BAD_REQUEST);
        }

        // Convert single file to array
        if (!is_array($files)) {
            $files = [$files];
        }

        $storagePath = $request->request->get('path');
        $options = json_decode($request->request->get('options', '{}'), true);
        
        // Add is_public parameter from request
        if ($request->request->has('is_public')) {
            $options['is_public'] = $request->request->getBoolean('is_public');
        }

        $uploadedFiles = [];
        $errors = [];

        foreach ($files as $index => $file) {
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
                $errors[] = [
                    'file' => $file->getClientOriginalName(),
                    'error' => $violations[0]->getMessage()
                ];
                continue;
            }

            try {
                $attachment = $this->fileUploadService->uploadFile(
                    $file,
                    $user,
                    $storagePath,
                    $options
                );

                $uploadedFiles[] = [
                    'id' => $attachment->getId(),
                    'fileName' => $attachment->getOriginalName(),
                    'fileSize' => $attachment->getSize(),
                    'fileType' => $attachment->getMimeType(),
                    'url' => $attachment->getPublicUrl(),
                    'uploadedAt' => $attachment->getCreatedAt()->format('c'),
                    'uploadedBy' => $user->getName(),
                    'metadata' => $attachment->getMetadata(),
                    'isPublic' => $attachment->isPublic(),
                ];
            } catch (FileException $e) {
                $errors[] = [
                    'file' => $file->getClientOriginalName(),
                    'error' => 'Chyba při ukládání souboru: ' . $e->getMessage()
                ];
            } catch (\Exception $e) {
                $errors[] = [
                    'file' => $file->getClientOriginalName(),
                    'error' => 'Neočekávaná chyba: ' . $e->getMessage()
                ];
            }
        }

        return new JsonResponse([
            'success' => count($uploadedFiles) > 0,
            'files' => $uploadedFiles,
            'errors' => $errors
        ]);
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
            return new JsonResponse([
                'error' => 'Soubor nenalezen'
            ], Response::HTTP_NOT_FOUND);
        }

        // Check if user can delete (uploaded by them or they are admin)
        if ($file->getUploadedBy() !== $user->getIntAdr() && !$this->isGranted('ROLE_ADMIN')) {
            return new JsonResponse([
                'error' => 'Nemáte oprávnění smazat tento soubor'
            ], Response::HTTP_FORBIDDEN);
        }

        try {
            // Check if user can delete immediately or use soft delete
            $forceDelete = $request->query->getBoolean('force', false);
            $this->fileUploadService->deleteFile($file, $forceDelete);
            
            return new JsonResponse([
                'success' => true,
                'deleted' => $file->isDeleted() ? 'soft' : 'hard'
            ]);
        } catch (\Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při mazání souboru'
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
            $data['data'] ?? null
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
            (int)$data['id']
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
}