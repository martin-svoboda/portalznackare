<?php

namespace App\Controller;

use App\Repository\FileAttachmentRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

class FileServeController extends AbstractController
{
    public function __construct(
        private FileAttachmentRepository $repository,
        private string $projectDir
    ) {
    }

    #[Route('/uploads/{path}/{token}/{filename}', 
        name: 'file_serve_protected',
        requirements: [
            'path' => '.+',
            'token' => '[a-f0-9]{16}',
            'filename' => '.+'
        ]
    )]
    public function serveProtected(
        string $path,
        string $token,
        string $filename,
        Request $request
    ): Response {
        // Build relative path
        $relativePath = $path . '/' . $filename;
        
        // Find file in database
        $file = $this->repository->findOneBy(['path' => $relativePath]);
        
        if (!$file || $file->isPublic()) {
            throw new NotFoundHttpException('Soubor nenalezen');
        }

        // Verify security token
        $expectedToken = substr(sha1($file->getHash() . $path), 0, 16);
        if ($token !== $expectedToken) {
            throw new NotFoundHttpException('Neplatný token');
        }

        return $this->createFileResponse($file, $relativePath, true);
    }

    #[Route('/uploads/{path}/{filename}', 
        name: 'file_serve_public',
        requirements: [
            'path' => '.+',
            'filename' => '.+'
        ],
        priority: -1
    )]
    public function servePublic(
        string $path,
        string $filename,
        Request $request
    ): Response {
        // Build relative path
        $relativePath = $path . '/' . $filename;
        
        // Find file in database
        $file = $this->repository->findOneBy(['path' => $relativePath]);
        
        if (!$file || !$file->isPublic()) {
            throw new NotFoundHttpException('Soubor nenalezen');
        }

        return $this->createFileResponse($file, $relativePath, false);
    }

    private function createFileResponse(
        $file, 
        string $relativePath, 
        bool $isProtected
    ): Response {
        // Build full file path
        $filePath = $this->projectDir . '/public/uploads/' . $relativePath;
        
        if (!file_exists($filePath)) {
            throw new NotFoundHttpException('Soubor nenalezen na disku');
        }

        // Create response
        $response = new BinaryFileResponse($filePath);
        
        // Set headers
        $response->headers->set('Content-Type', $file->getMimeType());
        $response->headers->set('Content-Disposition', 
            sprintf('inline; filename="%s"', $file->getOriginalName())
        );

        // Add cache headers (1 year)
        $response->setMaxAge(31536000);
        
        if ($isProtected) {
            $response->setPrivate();
            // Add no-index header for protected files
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        } else {
            $response->setPublic();
            // Public files can be indexed
        }

        return $response;
    }

    #[Route('/uploads/{path}/thumb_{filename}', 
        name: 'file_serve_thumb',
        requirements: [
            'path' => '.+',
            'filename' => '.+'
        ]
    )]
    public function serveThumbnail(
        string $path,
        string $filename,
        Request $request
    ): Response {
        // Build paths
        $relativePath = $path . '/' . $filename;
        $thumbPath = $path . '/thumb_' . $filename;
        
        // Find original file in database
        $file = $this->repository->findOneBy(['path' => $relativePath]);
        
        if (!$file || !$file->isImage()) {
            throw new NotFoundHttpException('Náhled nenalezen');
        }

        // Build full thumbnail path
        $filePath = $this->projectDir . '/public/uploads/' . $thumbPath;
        
        if (!file_exists($filePath)) {
            throw new NotFoundHttpException('Náhled nenalezen na disku');
        }

        // Create response
        $response = new BinaryFileResponse($filePath);
        
        // Set headers
        $response->headers->set('Content-Type', 'image/jpeg');
        $response->headers->set('Content-Disposition', 
            sprintf('inline; filename="thumb_%s"', $file->getOriginalName())
        );

        // Add cache headers
        $response->setMaxAge(31536000);
        $response->setPrivate();

        // Add no-index header
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow, noarchive');

        return $response;
    }
}