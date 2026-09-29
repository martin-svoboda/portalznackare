<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\InsyzController;
use App\Entity\Report;
use App\Entity\User;
use App\Exception\PrikazAccessDeniedException;
use App\Repository\ReportRepository;
use App\Service\DataEnricherService;
use App\Service\InsyzService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

/**
 * GET /api/insyz/user – plný profil jen sobě a adminovi; kolegovi z týmu příkazu
 * jen zúžený (jméno, SPZ, kvalifikace); ostatním nic.
 */
class InsyzUserAccessTest extends TestCase
{
    private const PLNY_PROFIL = [
        [['INT_ADR' => '4134', 'Jmeno' => 'Jan', 'Prijmeni' => 'Novák', 'RZ_Auta' => '1A2 3456',
          'Ulice_cp' => 'Hlavní 1', 'Telefon_zakladni' => '777', 'eMail' => 'jan@x.cz',
          'Datum_narozeni' => '1970-01-01', 'Bankovni_Ucet' => '123/0100']],
        [['Sekce' => 'Odpr', 'Rok_Cin' => 2025, 'Odpracovano' => 40]],
        [['Sekce' => 'Kval', 'INT_ADR' => '4134', 'Zkratka_Kval' => 'ZZ', 'Kvalifikace' => 'Značkař',
          'Misto_Kval' => 'Praha', 'Datum_Kval' => '2010-01-01', 'Zapsal_Kval' => 'X']],
        [['Sekce' => 'Sem', 'Seminar' => 'S1']],
        [],
    ];

    private InsyzService&MockObject $insyz;
    private ReportRepository&MockObject $reports;

    protected function setUp(): void
    {
        $this->insyz = $this->createMock(InsyzService::class);
        $this->reports = $this->createMock(ReportRepository::class);
        $this->insyz->method('getUser')->willReturn(self::PLNY_PROFIL);
        $this->insyz->method('getUserForTeam')->willReturn(['zuzeny']);
    }

    public function testVlastniProfilPlny(): void
    {
        $this->assertSame(self::PLNY_PROFIL, $this->data($this->call(4133, [], [])));
        $this->assertSame(self::PLNY_PROFIL, $this->data($this->call(4133, [], ['int_adr' => 4133])));
    }

    public function testAdminCiziProfilPlny(): void
    {
        $this->insyz->expects($this->never())->method('getPrikaz');
        $this->assertSame(self::PLNY_PROFIL, $this->data($this->call(5620, ['ROLE_ADMIN'], ['int_adr' => 4134])));
    }

    public function testCiziProfilBezIdZpOdepren(): void
    {
        $response = $this->call(4133, [], ['int_adr' => 4134]);
        $this->assertSame(403, $response->getStatusCode());
        $this->assertStringNotContainsString('Bankovni_Ucet', $response->getContent());
    }

    public function testKolegaZHlavickyPrikazuDostaneZuzenyProfil(): void
    {
        $this->insyz->method('getPrikaz')->with(4133, 52378)
            ->willReturn(['head' => ['INT_ADR_1' => '4133', 'INT_ADR_2' => '4134']]);

        $response = $this->call(4133, [], ['int_adr' => 4134, 'id_zp' => 52378]);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(['zuzeny'], $this->data($response));
    }

    public function testKolegaZUlozenehoHlaseniDostaneZuzenyProfil(): void
    {
        $this->insyz->method('getPrikaz')->willReturn(['head' => ['INT_ADR_1' => '4133']]);
        $report = new Report();
        $report->setTeamMembers([['INT_ADR' => 4133], ['INT_ADR' => '4134']]);
        $this->reports->method('findOneBy')->willReturn($report);

        $this->assertSame(['zuzeny'], $this->data($this->call(4133, [], ['int_adr' => 4134, 'id_zp' => 52378])));
    }

    public function testNeclenTymuOdepren(): void
    {
        $this->insyz->method('getPrikaz')->willReturn(['head' => ['INT_ADR_1' => '4133']]);
        $this->reports->method('findOneBy')->willReturn(null);

        $this->assertSame(403, $this->call(4133, [], ['int_adr' => 9999, 'id_zp' => 52378])->getStatusCode());
    }

    public function testCiziPrikazOdepren(): void
    {
        // Žadatel není na příkazu – nesmí přes cizí id_zp získat profily jeho týmu
        $this->insyz->method('getPrikaz')->willThrowException(new PrikazAccessDeniedException());

        $this->assertSame(403, $this->call(4133, [], ['int_adr' => 4134, 'id_zp' => 1])->getStatusCode());
    }

    public function testZuzenyProfilNeobsahujeOsobniUdaje(): void
    {
        $service = $this->getMockBuilder(InsyzService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getUser'])
            ->getMock();
        $service->method('getUser')->willReturn(self::PLNY_PROFIL);

        $zuzeny = $service->getUserForTeam(4134);

        $this->assertSame([['INT_ADR' => '4134', 'Jmeno' => 'Jan', 'Prijmeni' => 'Novák', 'RZ_Auta' => '1A2 3456']], $zuzeny[0]);
        $this->assertSame([], $zuzeny[1]);
        $this->assertSame([['INT_ADR' => '4134', 'Zkratka_Kval' => 'ZZ', 'Kvalifikace' => 'Značkař']], $zuzeny[2]);
        $this->assertSame([], $zuzeny[3]);
        $json = json_encode($zuzeny);
        foreach (['Ulice_cp', 'Telefon', 'eMail', 'Datum_narozeni', 'Bankovni_Ucet', 'Odpracovano', 'Seminar'] as $pole) {
            $this->assertStringNotContainsString($pole, $json);
        }
    }

    public function testCiziPrikazVraci403(): void
    {
        $this->insyz->method('getPrikaz')->willThrowException(new PrikazAccessDeniedException());

        $this->assertSame(403, $this->controller(9999, [])->getPrikaz(52378, new Request())->getStatusCode());
    }

    public function testUsekyCizihoPrikazuVraci403(): void
    {
        $this->insyz->method('getPrikaz')->willThrowException(new PrikazAccessDeniedException());
        $this->insyz->expects($this->never())->method('getZpUseky');

        $this->assertSame(403, $this->controller(9999, [])->getZpUseky(52378)->getStatusCode());
    }

    public function testUsekyPrikazuClenTymu(): void
    {
        $this->insyz->method('getPrikaz')->with(4133, 52378, false)->willReturn(['head' => []]);
        $this->insyz->method('getZpUseky')->willReturn([['EvCi_Tra' => 'X']]);

        $this->assertSame(200, $this->controller(4133, [])->getZpUseky(52378)->getStatusCode());
    }

    public function testUsekyAdminBezKontrolyTymu(): void
    {
        $this->insyz->expects($this->once())->method('getPrikaz')->with(5620, 52378, true)->willReturn(['head' => []]);
        $this->insyz->method('getZpUseky')->willReturn([]);

        $this->assertSame(200, $this->controller(5620, ['ROLE_SUPER_ADMIN'])->getZpUseky(52378)->getStatusCode());
    }

    private function call(int $intAdr, array $roles, array $query): JsonResponse
    {
        return $this->controller($intAdr, $roles)->getInsyzUser(new Request($query));
    }

    private function controller(int $intAdr, array $roles): InsyzController
    {
        $controller = new InsyzController($this->insyz, $this->createMock(DataEnricherService::class), $this->reports);

        $user = new User();
        $user->setIntAdr($intAdr);
        $user->setRoles($roles);
        $tokenStorage = new TokenStorage();
        $tokenStorage->setToken(new UsernamePasswordToken($user, 'main', $user->getRoles()));
        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);
        $controller->setContainer($container);

        return $controller;
    }

    private function data(JsonResponse $response): mixed
    {
        return json_decode($response->getContent(), true);
    }
}
