<?php

namespace App\Tests\Service;

use App\Service\AttachmentLookupService;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\KernelInterface;

class AttachmentLookupServiceTest extends TestCase
{
    private function service(array $row): AttachmentLookupService
    {
        $connection = $this->createMock(Connection::class);
        $connection->method('fetchAllAssociative')->willReturn([$row]);

        // Bez HTTP requestu (worker) → host se odvodí z prostředí (prod → portalznackare.cz)
        $kernel = $this->createMock(KernelInterface::class);
        $kernel->method('getEnvironment')->willReturn('prod');

        return new AttachmentLookupService($connection, new NullLogger(), new RequestStack(), $kernel);
    }

    private function row(array $overrides = []): array
    {
        return array_merge([
            'id' => 41,
            'original_name' => 'camera.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 195693,
            'path' => 'reports/2026/s/bn/53773/camera-1771079178624-f0459607.jpg',
            'public_url' => '/uploads/reports/2026/s/bn/53773/9818e89795b73d7e/camera-1771079178624-f0459607.jpg',
            'is_public' => null,
            'thumbnail_path' => null,
            'usage_info' => null,
        ], $overrides);
    }

    public function testPouzivaPublicUrlSTokenemABezRequestuVerejnouDomenu(): void
    {
        $result = $this->service($this->row())->getAttachmentsByIds([41]);

        $this->assertCount(1, $result);
        $this->assertSame(
            'https://portalznackare.cz/uploads/reports/2026/s/bn/53773/9818e89795b73d7e/camera-1771079178624-f0459607.jpg',
            $result[0]['url']
        );
        // Žádný localhost
        $this->assertStringNotContainsString('localhost', $result[0]['url']);
    }

    public function testFallbackNaPathKdyzPublicUrlChybi(): void
    {
        $result = $this->service($this->row(['public_url' => null]))->getAttachmentsByIds([41]);

        $this->assertSame(
            'https://portalznackare.cz/uploads/reports/2026/s/bn/53773/camera-1771079178624-f0459607.jpg',
            $result[0]['url']
        );
    }
}
