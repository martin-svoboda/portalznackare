<?php

namespace App\Controller;

use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use App\Repository\ReportRepository;
use App\Service\CzechVocativeService;
use App\Service\InsyzService;
use App\Service\InsyzReportHashService;
use App\Service\DataEnricherService;
use App\Entity\Report;
use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Core\Security;
use Symfony\Component\Serializer\SerializerInterface;
use Twig\Environment;

class AppController extends AbstractController
{
    #[Route('/', name: 'app_index')]
    public function index(CzechVocativeService $vocativeService): Response
    {
        $user = $this->getUser();
        $greeting = '';

        if ($user) {
            // Získáme jméno uživatele z security kontextu
            $firstName = $user->getJmeno() ?? '';

            if (!empty($firstName)) {
                $greeting = $vocativeService->createTimeBasedGreeting($firstName);
            }
        }

        return $this->render('pages/index.html.twig', [
            'greeting' => $greeting
        ]);
    }


    #[Route('/prihlaseni', name: 'app_login')]
    public function login(): Response
    {
        // Pokud je už uživatel přihlášený, přesměruj ho
        if ($this->getUser()) {
            return $this->redirectToRoute('app_dashboard');
        }

        // Získat redirect URL z query parametru
        $redirectUrl = $this->container->get('request_stack')->getCurrentRequest()->query->get('redirect');

        // Uložit redirect URL do session pro použití po přihlášení
        if ($redirectUrl) {
            $session = $this->container->get('request_stack')->getCurrentRequest()->getSession();
            $session->set('login_redirect_url', $redirectUrl);
        }

        return $this->render('pages/login.html.twig', [
            'redirect_url' => $redirectUrl
        ]);
    }

    #[Route('/nastenka', name: 'app_dashboard')]
    public function dashboard(): Response
    {
        // Přesměruj na úvodní stránku - nástěnka je teď na /
        return $this->redirectToRoute('app_index');
    }

    #[Route('/prikazy', name: 'app_prikazy')]
    public function prikazy(): Response
    {
        return $this->render('pages/prikazy.html.twig');
    }

    #[Route('/prikaz/{id}', name: 'app_prikaz_detail')]
    public function prikazDetail(int $id): Response
    {
        return $this->render('pages/prikaz-detail.html.twig', [
            'id' => $id
        ]);
    }

    #[Route('/prikaz/{id}/hlaseni', name: 'app_prikaz_hlaseni')]
    public function prikazHlaseni(
        int $id,
        Request $request,
        ReportRepository $reportRepository,
        InsyzReportHashService $hashService,
        InsyzService $insyzService,
        DataEnricherService $dataEnricher,
        SerializerInterface $serializer
    ): Response {
        // Přihlášený uživatel → dnešní chování (plná appka, editace dle práv)
        if ($this->getUser() instanceof User) {
            return $this->render('pages/prikaz-hlaseni.html.twig', [
                'id' => $id,
                'insyz_view' => false,
                'insyz_bootstrap_json' => null,
            ]);
        }

        // Anonym → povolit pouze s platným insyz-hash
        $hash = (string) $request->query->get('insyz-hash', '');
        if ($hash === '') {
            return $this->render('pages/prikaz-hlaseni.html.twig', [
                'id' => $id,
                'insyz_view' => false,
                'insyz_bootstrap_json' => null,
            ]);
        }

        $report = $reportRepository->findOneBy(['idZp' => $id]);
        if (!$report) {
            throw $this->createNotFoundException('Hlášení nenalezeno');
        }

        if (!$hashService->verify($report->getCisloZp(), $hash)) {
            // Čistý 403 (ne security AccessDenied, který by anonyma redirectoval na login)
            throw new AccessDeniedHttpException('Neplatný podpis URL');
        }

        $bootstrap = $this->buildInsyzBootstrap(
            $report, $insyzService, $dataEnricher, $serializer
        );

        // Bezpečné enkódování pro vložení do <script type="application/json">:
        // JSON_HEX_TAG zabrání </script> breakoutu.
        $bootstrapJson = json_encode(
            $bootstrap,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        );

        return $this->render('pages/prikaz-hlaseni.html.twig', [
            'id' => $id,
            'insyz_view' => true,
            'insyz_bootstrap_json' => $bootstrapJson,
        ]);
    }

    /**
     * Sestaví data, která React aplikace běžně získává ze 4 chráněných
     * /api/* volání. Volá tytéž services, takže se neduplikuje logika.
     */
    private function buildInsyzBootstrap(
        Report $report,
        InsyzService $insyzService,
        DataEnricherService $dataEnricher,
        SerializerInterface $serializer
    ): array {
        $ownerIntAdr = $report->getIntAdr();
        $idZp = $report->getIdZp();

        // 1) Detail příkazu z INSYZ + enrich (= GET /api/insyz/prikaz/{id})
        $orderData = $dataEnricher->enrichPrikazDetail(
            $insyzService->getPrikaz($ownerIntAdr, $idZp, true)
        );

        // 2) Uložené hlášení (= GET /api/portal/report) – stejná serializace
        $reportData = json_decode(
            $serializer->serialize($report, 'json', ['groups' => ['report:read']]),
            true
        );

        // 3) Sazby pro datum provedení (= GET /api/insyz/sazby)
        $date = $this->resolveExecutionDate($report, $orderData);
        $sazby = $insyzService->getSazby($date);

        // 4) Detaily členů týmu (= GET /api/insyz/user pro každého)
        $usersDetails = [];
        foreach (($report->getTeamMembers() ?: []) as $member) {
            $intAdr = (int) ($member['INT_ADR'] ?? 0);
            if ($intAdr > 0 && !isset($usersDetails[$intAdr])) {
                try {
                    $usersDetails[$intAdr] = $insyzService->getUser($intAdr);
                } catch (\Throwable $e) {
                    // detail jednoho uživatele není kritický
                }
            }
        }

        return [
            'orderData' => $orderData,
            'reportData' => $reportData,
            'sazby' => $sazby,
            'usersDetails' => $usersDetails,
        ];
    }

    /**
     * Datum pro načtení sazeb: nejpozdější datum segmentu z hlášení (dataA),
     * fallback Provedeni z hlavičky, fallback dnešek.
     */
    private function resolveExecutionDate(Report $report, array $orderData): string
    {
        $latest = null;
        $dataA = $report->getDataA() ?: [];
        foreach (($dataA['Skupiny_Cest'] ?? []) as $group) {
            foreach (($group['Cesty'] ?? []) as $segment) {
                $datum = $segment['Datum'] ?? null;
                if (!$datum) {
                    continue;
                }
                $ts = strtotime((string) $datum);
                if ($ts !== false && ($latest === null || $ts > $latest)) {
                    $latest = $ts;
                }
            }
        }
        if ($latest !== null) {
            return date('Y-m-d', $latest);
        }
        $provedeni = $orderData['head']['Provedeni'] ?? null;
        if ($provedeni) {
            return date('Y-m-d', strtotime((string) $provedeni));
        }
        return date('Y-m-d');
    }

    #[Route('/metodika', name: 'app_metodika')]
    public function metodika(PageRepository $pageRepository): Response
    {
        $dily = $pageRepository->findBy([
            'contentType' => PageContentTypeEnum::METODIKA,
            'parent' => null,
            'status' => PageStatusEnum::PUBLISHED,
        ], ['sortOrder' => 'ASC']);

        return $this->render('pages/metodika.html.twig', [
            'dily' => $dily,
        ]);
    }

    #[Route('/downloads', name: 'app_downloads')]
    public function downloads(): Response
    {
        return $this->render('pages/downloads.html.twig');
    }

    #[Route('/profil', name: 'app_profil')]
    public function profil(InsyzService $insyzService): Response
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->redirectToRoute('app_index');
        }

        try {
            // Získat multidataset z INSYZ
            $insyzData = $insyzService->getUser($user->getIntAdr());

            // Extrahovat hlavičku uživatele (první dataset)
            $userHeader = $insyzData[0][0] ?? [];

            // Extrahovat další datasety pro profil
            $odpracovano = $insyzData[1] ?? [];
            $kvalifikace = $insyzData[2] ?? [];
            $seminare = $insyzData[3] ?? [];

        } catch (\Exception $e) {
            // V případě chyby použij základní data z databáze
            $userHeader = [];
            $odpracovano = [];
            $kvalifikace = [];
            $seminare = [];
        }

        return $this->render('pages/profil.html.twig', [
            'user' => $user,
            'insyz_data' => $userHeader,
            'odpracovano' => $odpracovano,
            'kvalifikace' => $kvalifikace,
            'seminare' => $seminare
        ]);
    }

    /**
     * HTML náhled kontrolního formuláře PDF pro ladění stylů
     */
    #[Route('/prikaz/{id}/pdf-preview', name: 'app_pdf_preview', methods: ['GET'])]
    public function pdfPreview(
        int $id,
        InsyzService $insyzService,
        DataEnricherService $dataEnricher,
        Environment $twig
    ): Response {
        // Autentifikace
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new Response('Nepřihlášený uživatel', Response::HTTP_UNAUTHORIZED);
        }

        try {
            // Načíst data z INSYZ
            $isAdmin = in_array('ROLE_ADMIN', $user->getRoles());
            $prikazData = $insyzService->getPrikaz($user->getIntAdr(), $id, $isAdmin);

            // Obohatit data - PŘESNĚ stejně jako pro PDF
            $enrichedData = $dataEnricher->enrichPrikazDetail($prikazData, true);

            // Render HTML template - PŘESNĚ stejně jako pro PDF
            $html = $twig->render('pdf/control_form.html.twig', [
                'prikaz' => $enrichedData,
                'head' => $enrichedData['head'] ?? [],
                'useky' => $enrichedData['useky'] ?? [],
                'predmety' => $enrichedData['predmety'] ?? [],
                'generated_at' => new \DateTime()
            ]);

            // Vrátit čisté HTML jako normální stránka (bez API CSP)
            return new Response($html);

        } catch (\Exception $e) {
            return new Response('Chyba: ' . $e->getMessage(), Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/{slug}', name: 'app_catch_all', requirements: ['slug' => '^(?!napoveda|build|uploads|images|favicon|site\.webmanifest|apple-touch-icon).*'], priority: -200)]
    public function catchAll(): Response
    {
        return $this->render('pages/404.html.twig');
    }
}