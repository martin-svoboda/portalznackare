<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\FileController;
use App\Entity\FileAttachment;
use App\Entity\User;
use App\Repository\FileAttachmentRepository;
use App\Service\FileUploadService;
use App\Service\ImageProcessingService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * GET /api/portal/files/{id} – ID jsou postupná, chráněný soubor jen nahrávajícímu nebo adminovi.
 */
class FileControllerGetFileTest extends TestCase
{
    #[DataProvider('pripady')]
    public function testPristupKSouboru(bool $verejny, int $nahral, int $zadatel, array $role, int $ocekavano): void
    {
        $file = (new FileAttachment())
            ->setIsPublic($verejny)
            ->setUploadedBy($nahral)
            ->setPublicUrl('/uploads/reports/2026/x/abcdef0123456789/uctenka.jpg')
            ->setOriginalName('uctenka.jpg')
            ->setSize(1000)
            ->setMimeType('image/jpeg');

        $response = $this->controller($file, $zadatel, $role)->getFile(98);

        $this->assertSame($ocekavano, $response->getStatusCode());
        if ($ocekavano === 404) {
            $this->assertStringNotContainsString('uploads', $response->getContent());
        }
    }

    public static function pripady(): array
    {
        return [
            'chráněný, cizí značkař' => [false, 4133, 9999, [], 404],
            'chráněný, kdo nahrál' => [false, 4133, 4133, [], 200],
            'chráněný, admin' => [false, 4133, 5620, ['ROLE_ADMIN'], 200],
            'veřejný, kdokoli přihlášený' => [true, 4133, 9999, [], 200],
        ];
    }

    public function testNeexistujiciSoubor(): void
    {
        $this->assertSame(404, $this->controller(null, 4133, [])->getFile(1)->getStatusCode());
    }

    #[DataProvider('pouziti')]
    public function testZmenaPouzitiJenNahravajiciNeboAdmin(string $akce, int $zadatel, array $role, int $ocekavano): void
    {
        $file = (new FileAttachment())->setIsPublic(false)->setUploadedBy(4133);
        $controller = $this->controller($file, $zadatel, $role, $akce === 'addUsage' ? 'addFileUsage' : 'removeFileUsage');
        $request = new Request([], [], [], [], [], [], json_encode(['fileId' => 98, 'type' => 'reports', 'id' => 1]));

        $this->assertSame($ocekavano, $controller->$akce($request)->getStatusCode());
    }

    public static function pouziti(): array
    {
        return [
            'přidání – cizí' => ['addUsage', 9999, [], 403],
            'odebrání – cizí' => ['removeUsage', 9999, [], 403],
            'přidání – kdo nahrál' => ['addUsage', 4133, [], 200],
            'odebrání – admin' => ['removeUsage', 5620, ['ROLE_ADMIN'], 200],
        ];
    }

    private function controller(?FileAttachment $file, int $intAdr, array $roles, ?string $usageMethod = null): FileController
    {
        $service = $this->createMock(FileUploadService::class);
        $service->method('getFile')->willReturn($file);
        if ($usageMethod) {
            // Změna použití se smí provést až po kontrole oprávnění
            $service->expects($this->atMost(1))->method($usageMethod)->willReturn($file);
        }

        $controller = new FileController(
            $service,
            $this->createMock(ImageProcessingService::class),
            $this->createMock(ValidatorInterface::class),
            $this->createMock(FileAttachmentRepository::class)
        );

        $user = new User();
        $user->setIntAdr($intAdr);
        $user->setRoles($roles);
        $tokenStorage = new TokenStorage();
        $tokenStorage->setToken(new UsernamePasswordToken($user, 'main', $user->getRoles()));

        $auth = $this->createMock(AuthorizationCheckerInterface::class);
        $auth->method('isGranted')->willReturnCallback(fn (string $role) => in_array($role, $user->getRoles(), true));

        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $auth);
        $controller->setContainer($container);

        return $controller;
    }
}
