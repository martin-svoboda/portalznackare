<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\PortalController;
use App\Entity\Report;
use App\Entity\User;
use App\Enum\ReportStateEnum;
use App\Exception\PrikazAccessDeniedException;
use App\Message\SendToInsyzMessage;
use App\Repository\ReportRepository;
use App\Service\AttachmentLookupService;
use App\Service\InsyzService;
use App\Service\PdfGeneratorService;
use App\Service\UserPreferenceService;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\DependencyInjection\ParameterBag\ContainerBag;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBag;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

/**
 * /api/portal/report – oprávnění a stavy hlášení. Bez DB, vše mockované.
 *
 * Oprávnění: hlášení smí číst a ukládat jen člen týmu příkazu (INT_ADR v hlavičce
 * příkazu) nebo admin.
 * Stavy: klient posílá jen draft/send; odeslané hlášení (send/submitted/approved)
 * běžný uživatel už nezmění, admin ano; do fronty INSYZ jde zpráva až po commitu.
 */
class PortalControllerReportTest extends TestCase
{
    private const ID_ZP = 52378;

    private InsyzService&MockObject $insyzService;
    private ReportRepository&MockObject $reportRepository;
    private EntityManagerInterface&MockObject $entityManager;
    private MessageBusInterface&MockObject $messageBus;
    /** @var string[] pořadí volání transakce a fronty */
    private array $calls = [];

    protected function setUp(): void
    {
        $this->calls = [];
        $this->insyzService = $this->createMock(InsyzService::class);
        $this->reportRepository = $this->createMock(ReportRepository::class);
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->entityManager->method('getConnection')->willReturn($this->createMock(Connection::class));
        foreach (['beginTransaction', 'commit', 'rollback', 'flush'] as $method) {
            $this->entityManager->method($method)->willReturnCallback(function () use ($method) {
                $this->calls[] = $method;
            });
        }
        $this->messageBus = $this->createMock(MessageBusInterface::class);
        $this->messageBus->method('dispatch')->willReturnCallback(function (object $message) {
            $this->calls[] = 'dispatch';
            return new Envelope($message);
        });
    }

    // --- Oprávnění ---------------------------------------------------------

    public function testCiziZnackarNecteHlaseni(): void
    {
        $this->insyzService->expects($this->once())
            ->method('getPrikaz')
            ->with(9999, self::ID_ZP, false)
            ->willThrowException(new PrikazAccessDeniedException());
        $this->reportRepository->expects($this->never())->method('findOneBy');

        $response = $this->get($this->user(9999));

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testCiziZnackarNeuloziHlaseni(): void
    {
        $this->insyzService->method('getPrikaz')
            ->willThrowException(new PrikazAccessDeniedException());
        $this->reportRepository->expects($this->never())->method('findOneByIdZpForUpdate');

        $response = $this->post($this->user(9999), ['state' => 'send']);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
        $this->assertSame([], $this->calls);
    }

    public function testClenTymuCteHlaseni(): void
    {
        $this->insyzService->expects($this->once())
            ->method('getPrikaz')
            ->with(4133, self::ID_ZP, false)
            ->willReturn(['head' => ['INT_ADR_1' => '4133']]);
        $this->reportRepository->method('findOneBy')->willReturn($this->report());

        $response = $this->get($this->user(4133));

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertSame(self::ID_ZP, json_decode($response->getContent(), true)['id_zp']);
    }

    public function testClenTymuUloziKoncept(): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn($this->report());

        $response = $this->post($this->user(4133), ['state' => 'draft']);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertSame(['beginTransaction', 'flush', 'commit'], $this->calls);
    }

    #[DataProvider('adminRoles')]
    public function testAdminMaPristupKCizimuPrikazu(string $role): void
    {
        $this->insyzService->expects($this->once())
            ->method('getPrikaz')
            ->with(5620, self::ID_ZP, true)
            ->willReturn(['head' => ['INT_ADR_1' => '4133']]);
        $this->reportRepository->method('findOneBy')->willReturn($this->report());

        $response = $this->get($this->user(5620, [$role]));

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    public static function adminRoles(): array
    {
        return [['ROLE_ADMIN'], ['ROLE_SUPER_ADMIN']];
    }

    public function testVypadekInsyzNevydaHlaseni(): void
    {
        $this->insyzService->method('getPrikaz')
            ->willThrowException(new \Exception('MSSQL timeout'));
        $this->reportRepository->expects($this->never())->method('findOneBy');

        $response = $this->get($this->user(4133));

        $this->assertSame(Response::HTTP_SERVICE_UNAVAILABLE, $response->getStatusCode());
        $this->assertStringNotContainsString('MSSQL', $response->getContent());
    }

    public function testPostBezIdZpNeoveruje(): void
    {
        $this->insyzService->expects($this->never())->method('getPrikaz');

        $response = $this->controller($this->user(4133))->report(
            new Request([], [], [], [], [], ['REQUEST_METHOD' => 'POST'], json_encode(['cislo_zp' => 'X']))
        );

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    // --- Stavy -------------------------------------------------------------

    #[DataProvider('stavyNastavovaneSystemem')]
    public function testKlientNenastaviSystemovyStav(string $state): void
    {
        $this->allowAccess();
        $this->reportRepository->expects($this->never())->method('findOneByIdZpForUpdate');

        $response = $this->post($this->user(4133), ['state' => $state]);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertSame([], $this->calls);
    }

    public static function stavyNastavovaneSystemem(): array
    {
        return [['approved'], ['rejected'], ['submitted'], ['cokoliv']];
    }

    #[DataProvider('odeslaneStavy')]
    public function testOdeslaneHlaseniNelzeZmenit(ReportStateEnum $current, string $state): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn($this->report($current));

        $response = $this->post($this->user(4133), ['state' => $state]);

        $this->assertSame(Response::HTTP_CONFLICT, $response->getStatusCode());
        $this->assertSame('REPORT_NOT_EDITABLE', json_decode($response->getContent(), true)['error_code']);
        $this->assertSame(['beginTransaction', 'rollback'], $this->calls);
    }

    public static function odeslaneStavy(): array
    {
        return [
            'send → draft (vrácení během odesílání)' => [ReportStateEnum::SEND, 'draft'],
            'send → send (dvojklik)' => [ReportStateEnum::SEND, 'send'],
            'submitted → draft' => [ReportStateEnum::SUBMITTED, 'draft'],
            'submitted → send (druhé odeslání)' => [ReportStateEnum::SUBMITTED, 'send'],
            'approved → send' => [ReportStateEnum::APPROVED, 'send'],
        ];
    }

    #[DataProvider('editovatelneStavy')]
    public function testOdeslaniZarazeneDoFrontyAzPoCommitu(ReportStateEnum $current): void
    {
        $this->allowAccess();
        $report = $this->report($current);
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn($report);

        $response = $this->post($this->user(4133), ['state' => 'send']);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertSame(ReportStateEnum::SEND, $report->getState());
        $this->assertSame(['beginTransaction', 'flush', 'commit', 'dispatch'], $this->calls);
    }

    public static function editovatelneStavy(): array
    {
        return [
            'koncept' => [ReportStateEnum::DRAFT],
            'po zamítnutí znovu' => [ReportStateEnum::REJECTED],
        ];
    }

    public function testNoveHlaseniLzeRovnouOdeslat(): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn(null);
        $this->entityManager->method('persist')->willReturnCallback(function (Report $r) {
            $r->onPrePersist();
            $this->assignId($r);
        });

        $response = $this->post($this->user(4133), ['state' => 'send']);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertSame(['beginTransaction', 'flush', 'commit', 'dispatch'], $this->calls);
    }

    public function testAdminMuzeZasahnoutDoOdeslanehoHlaseni(): void
    {
        $this->allowAccess();
        $report = $this->report(ReportStateEnum::SUBMITTED);
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn($report);

        $response = $this->post($this->user(5620, ['ROLE_ADMIN']), ['state' => 'draft']);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertSame(ReportStateEnum::DRAFT, $report->getState());
    }

    public function testChybaPriUlozeniVratiTransakci(): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneByIdZpForUpdate')
            ->willThrowException(new \RuntimeException('lock timeout'));

        $response = $this->post($this->user(4133), ['state' => 'send']);

        $this->assertSame(Response::HTTP_INTERNAL_SERVER_ERROR, $response->getStatusCode());
        $this->assertSame(['beginTransaction', 'rollback'], $this->calls);
    }

    // --- Jen vedoucí ukládá --------------------------------------------------

    #[DataProvider('stavyKlienta')]
    public function testClenTymuKteryNeniVedouciNeulozi(string $state): void
    {
        $this->allowAccess();
        $this->reportRepository->expects($this->never())->method('findOneByIdZpForUpdate');

        $response = $this->post($this->user(4134), ['state' => $state]);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
        $this->assertSame('NOT_LEADER', json_decode($response->getContent(), true)['error_code']);
        $this->assertSame([], $this->calls);
    }

    public static function stavyKlienta(): array
    {
        return ['koncept' => ['draft'], 'odeslání' => ['send']];
    }

    public function testClenTymuKteryNeniVedouciHlaseniCte(): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneBy')->willReturn($this->report());

        $this->assertSame(Response::HTTP_OK, $this->get($this->user(4134))->getStatusCode());
    }

    public function testAdminMimoTymUlozi(): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn($this->report());

        $response = $this->post($this->user(5620, ['ROLE_SUPER_ADMIN']), ['state' => 'draft']);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    // --- Přesměrování výplaty ------------------------------------------------

    #[DataProvider('neplatnaPresmerovani')]
    public function testPresmerovaniMimoTymOdmitnuto(array $presmerovani, array $role): void
    {
        $this->allowAccess();
        $this->reportRepository->expects($this->never())->method('findOneByIdZpForUpdate');

        $response = $this->post($this->user($role ? 5620 : 4133, $role), [
            'state' => 'draft',
            'data_a' => ['Presmerovani_Vyplat' => $presmerovani],
        ]);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertSame('INVALID_REDIRECT', json_decode($response->getContent(), true)['error_code']);
    }

    public static function neplatnaPresmerovani(): array
    {
        return [
            'cíl mimo tým' => [['4134' => '9999'], []],
            'zdroj mimo tým' => [['9999' => '4133'], []],
            'i admin' => [['4134' => '9999'], ['ROLE_ADMIN']],
        ];
    }

    #[DataProvider('platnaPresmerovani')]
    public function testPresmerovaniVTymuPovoleno(array $presmerovani): void
    {
        $this->allowAccess();
        $this->reportRepository->method('findOneByIdZpForUpdate')->willReturn($this->report());

        $response = $this->post($this->user(4133), [
            'state' => 'draft',
            'data_a' => ['Presmerovani_Vyplat' => $presmerovani],
        ]);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    public static function platnaPresmerovani(): array
    {
        return [
            'člen na vedoucího' => [['4134' => '4133']],
            'klíč s podtržítkem' => [['_4134' => 4133]],
            'žádné (prázdný objekt/pole)' => [[]],
        ];
    }

    // --- Pomocné -----------------------------------------------------------

    /** 4133 = vedoucí, 4134 = člen týmu (ne vedoucí) */
    private function allowAccess(): void
    {
        $this->insyzService->method('getPrikaz')->willReturn(['head' => [
            'INT_ADR_1' => '4133', 'Je_Vedouci1' => '1',
            'INT_ADR_2' => '4134', 'Je_Vedouci2' => '0',
        ]]);
    }

    private function get(User $user): Response
    {
        $request = new Request(['id_zp' => (string) self::ID_ZP]);
        $request->setMethod('GET');

        return $this->controller($user)->report($request);
    }

    private function post(User $user, array $overrides): Response
    {
        $payload = array_merge([
            'id_zp' => self::ID_ZP,
            'cislo_zp' => 'S/BN/S/26058',
            'data_a' => [],
            'data_b' => [],
        ], $overrides);

        return $this->controller($user)->report(
            new Request([], [], [], [], [], ['REQUEST_METHOD' => 'POST'], json_encode($payload))
        );
    }

    private function controller(User $user): PortalController
    {
        $controller = new PortalController(
            $this->reportRepository,
            $this->entityManager,
            $this->messageBus,
            $this->createMock(AttachmentLookupService::class),
            $this->createMock(UserPreferenceService::class),
            $this->createMock(PdfGeneratorService::class),
            $this->insyzService
        );

        $tokenStorage = new TokenStorage();
        $tokenStorage->setToken(new UsernamePasswordToken($user, 'main', $user->getRoles()));

        $container = new Container(new ParameterBag(['kernel.environment' => 'test']));
        $container->set('security.token_storage', $tokenStorage);
        $container->set('parameter_bag', new ContainerBag($container));
        $controller->setContainer($container);

        return $controller;
    }

    private function user(int $intAdr, array $roles = []): User
    {
        $user = new User();
        $user->setIntAdr($intAdr);
        $user->setRoles($roles);

        return $user;
    }

    private function report(ReportStateEnum $state = ReportStateEnum::DRAFT): Report
    {
        $report = new Report();
        $report->setIdZp(self::ID_ZP);
        $report->setCisloZp('S/BN/S/26058');
        $report->setIntAdr(4133);
        $report->setState($state);
        $report->onPrePersist();
        $this->assignId($report);

        return $report;
    }

    /** ID v reálu přiděluje databáze při flush */
    private function assignId(Report $report): void
    {
        (new \ReflectionProperty(Report::class, 'id'))->setValue($report, 456);
    }
}
