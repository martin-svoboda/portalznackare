<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\AuditLog;
use App\Entity\InsyzAuditLog;
use App\Entity\Report;
use App\Service\SystemOptionService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin')]
#[IsGranted('ROLE_ADMIN')]
class AdminController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private SystemOptionService $systemOptionService
    ) {}

    #[Route('/', name: 'admin_dashboard')]
    public function dashboard(): Response
    {
        $stats = [
            'users' => [
                'total' => $this->entityManager->getRepository(User::class)->count([]),
                'active' => $this->entityManager->getRepository(User::class)->count(['isActive' => true]),
                'admins' => $this->entityManager->getConnection()
                    ->executeQuery('SELECT COUNT(u.id) FROM users u WHERE u.roles::text LIKE ?', ['%"ROLE_ADMIN"%'])
                    ->fetchOne(),
                'recent_logins' => $this->entityManager->getRepository(User::class)
                    ->createQueryBuilder('u')
                    ->select('COUNT(u.id)')
                    ->where('u.lastLoginAt >= :date')
                    ->setParameter('date', new \DateTime('-7 days'))
                    ->getQuery()
                    ->getSingleScalarResult(),
            ],
            'reports' => [
                'total' => $this->entityManager->getRepository(Report::class)->count([]),
                'draft' => $this->entityManager->getRepository(Report::class)->count(['state' => 'draft']),
                'submitted' => $this->entityManager->getRepository(Report::class)->count(['state' => 'submitted']),
                'approved' => $this->entityManager->getRepository(Report::class)->count(['state' => 'approved']),
            ],
            'audit' => [
                'today' => $this->entityManager->getRepository(AuditLog::class)
                    ->createQueryBuilder('a')
                    ->select('COUNT(a.id)')
                    ->where('a.createdAt >= :date')
                    ->setParameter('date', new \DateTime('today'))
                    ->getQuery()
                    ->getSingleScalarResult(),
                'week' => $this->entityManager->getRepository(AuditLog::class)
                    ->createQueryBuilder('a')
                    ->select('COUNT(a.id)')
                    ->where('a.createdAt >= :date')
                    ->setParameter('date', new \DateTime('-7 days'))
                    ->getQuery()
                    ->getSingleScalarResult(),
            ],
            'insyz' => [
                'today_calls' => $this->entityManager->getRepository(InsyzAuditLog::class)
                    ->createQueryBuilder('i')
                    ->select('COUNT(i.id)')
                    ->where('i.createdAt >= :date')
                    ->setParameter('date', new \DateTime('today'))
                    ->getQuery()
                    ->getSingleScalarResult(),
                'today_errors' => $this->entityManager->getRepository(InsyzAuditLog::class)
                    ->createQueryBuilder('i')
                    ->select('COUNT(i.id)')
                    ->where('i.createdAt >= :date')
                    ->andWhere('i.status = :status')
                    ->setParameter('date', new \DateTime('today'))
                    ->setParameter('status', 'error')
                    ->getQuery()
                    ->getSingleScalarResult(),
            ]
        ];

        $recentAuditLogs = $this->entityManager->getRepository(AuditLog::class)
            ->createQueryBuilder('a')
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult();

        return $this->render('admin/dashboard.html.twig', [
            'stats' => $stats,
            'recent_audit_logs' => $recentAuditLogs,
        ]);
    }

    #[Route('/uzivatele', name: 'admin_users')]
    public function users(): Response
    {
        $users = $this->entityManager->getRepository(User::class)->findAll();
        return $this->render('admin/users.html.twig', ['users' => $users]);
    }

    #[Route('/audit-logy', name: 'admin_audit_logs')]
    public function auditLogs(): Response
    {
        $logs = $this->entityManager->getRepository(AuditLog::class)
            ->createQueryBuilder('a')
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults(100)
            ->getQuery()
            ->getResult();
            
        return $this->render('admin/audit-logs.html.twig', ['logs' => $logs]);
    }

    #[Route('/insyz-monitoring', name: 'admin_insyz_monitoring')]
    public function insyzMonitoring(): Response
    {
        $logs = $this->entityManager->getRepository(InsyzAuditLog::class)
            ->createQueryBuilder('i')
            ->orderBy('i.createdAt', 'DESC')
            ->setMaxResults(100)
            ->getQuery()
            ->getResult();
            
        return $this->render('admin/insyz-monitoring.html.twig', ['logs' => $logs]);
    }

    #[Route('/hlaseni', name: 'admin_reports')]
    public function reports(): Response
    {
        return $this->render('admin/reports.html.twig');
    }

    #[Route('/hlaseni/{id}', name: 'admin_report_detail', requirements: ['id' => '\d+'])]
    public function reportDetail(int $id): Response
    {
        return $this->render('admin/report-detail.html.twig', [
            'reportId' => $id
        ]);
    }

    #[Route('/api/reports', name: 'admin_api_reports', methods: ['GET'])]
    public function apiReports(): Response
    {
        $reports = $this->entityManager->getRepository(Report::class)
            ->createQueryBuilder('r')
            ->orderBy('r.dateUpdated', 'DESC')
            ->getQuery()
            ->getResult();

        $data = [];
        foreach ($reports as $report) {
            $data[] = [
                'id' => $report->getId(),
                'cisloZp' => $report->getCisloZp(),
                'znackari' => $report->getTeamMembers(),
                'state' => $report->getState()->value,
                'dateCreated' => $report->getDateCreated()->format('c'),
                'dateUpdated' => $report->getDateUpdated()->format('c'),
                'dateSend' => $report->getDateSend() ? $report->getDateSend()->format('c') : null,
            ];
        }

        return $this->json($data);
    }

    #[Route('/api/reports/{id}', name: 'admin_api_report_detail', methods: ['GET'])]
    public function apiReportDetail(int $id): Response
    {
        $report = $this->entityManager->getRepository(Report::class)->find($id);
        
        if (!$report) {
            return $this->json(['error' => 'Hlášení nenalezeno'], 404);
        }

        return $this->json([
            'id' => $report->getId(),
            'cisloZp' => $report->getCisloZp(),
            'znackari' => $report->getTeamMembers(),
            'state' => $report->getState()->value,
            'dateCreated' => $report->getDateCreated()->format('c'),
            'dateUpdated' => $report->getDateUpdated()->format('c'),
            'dateSend' => $report->getDateSend() ? $report->getDateSend()->format('c') : null,
            'dataA' => $report->getDataA(),
            'dataB' => $report->getDataB(),
            'calculation' => $report->getCalculation(),
            'history' => $report->getHistory(),
        ]);
    }

    #[Route('/api/reports/{id}/state', name: 'admin_api_report_state', methods: ['POST'])]
    public function apiChangeReportState(Request $request, int $id): Response
    {
        $report = $this->entityManager->getRepository(Report::class)->find($id);
        
        if (!$report) {
            return $this->json(['error' => 'Hlášení nenalezeno'], 404);
        }

        $data = json_decode($request->getContent(), true);
        $newState = $data['state'] ?? null;

        if (!$newState) {
            return $this->json(['error' => 'Chybí stav'], 400);
        }

        try {
            $reportState = match ($newState) {
                'draft' => \App\Enum\ReportStateEnum::DRAFT,
                'send' => \App\Enum\ReportStateEnum::SEND,
                'submitted' => \App\Enum\ReportStateEnum::SUBMITTED,
                'approved' => \App\Enum\ReportStateEnum::APPROVED,
                'rejected' => \App\Enum\ReportStateEnum::REJECTED,
                default => throw new \InvalidArgumentException('Neplatný stav')
            };

            $oldState = $report->getState()->value;
            $report->setState($reportState);

            // Přidat do historie
            $report->addHistoryEntry(
                'admin_state_changed',
                $this->getUser()->getIntAdr(),
                "Admin změnil stav z '{$oldState}' na '{$newState}'",
                ['from' => $oldState, 'to' => $newState]
            );

            $this->entityManager->flush();

            return $this->json(['success' => true]);

        } catch (\Exception $e) {
            return $this->json(['error' => 'Chyba při změně stavu: ' . $e->getMessage()], 400);
        }
    }

    #[Route('/system-nastaveni', name: 'admin_system_options')]
    #[IsGranted('ROLE_SUPER_ADMIN')]
    public function systemOptions(Request $request): Response
    {
        if ($request->isMethod('POST')) {
            // Uložit nastavení z POST dat
            $this->systemOptionService->set('maintenance.scheduled_downtime', $request->request->get('maintenance_scheduled_downtime'));
            $this->systemOptionService->set('audit.retention_days', $request->request->get('audit_retention_days', 90));
            $this->systemOptionService->set('audit.log_ip_addresses', $request->request->has('audit_log_ip_addresses'));
            $this->systemOptionService->set('insyz_audit.enabled', $request->request->has('insyz_audit_enabled'));
            $this->systemOptionService->set('insyz_audit.log_requests', $request->request->has('insyz_audit_log_requests'));
            $this->systemOptionService->set('insyz_audit.log_responses', $request->request->has('insyz_audit_log_responses'));
            $this->systemOptionService->set('insyz_audit.retention_days', $request->request->get('insyz_audit_retention_days', 60));
            
            $this->addFlash('success', 'Nastavení uloženo');
            return $this->redirectToRoute('admin_system_options');
        }
        
        // Načíst aktuální hodnoty
        $settings = [
            'maintenance_scheduled_downtime' => $this->systemOptionService->get('maintenance.scheduled_downtime'),
            'audit_retention_days' => $this->systemOptionService->get('audit.retention_days', 90),
            'audit_log_ip_addresses' => $this->systemOptionService->get('audit.log_ip_addresses', true),
            'insyz_audit_enabled' => $this->systemOptionService->get('insyz_audit.enabled', true),
            'insyz_audit_log_requests' => $this->systemOptionService->get('insyz_audit.log_requests', true),
            'insyz_audit_log_responses' => $this->systemOptionService->get('insyz_audit.log_responses', true),
            'insyz_audit_retention_days' => $this->systemOptionService->get('insyz_audit.retention_days', 60),
        ];

        return $this->render('admin/system-options.html.twig', ['settings' => $settings]);
    }

    #[Route('/cms', name: 'admin_cms_pages')]
    public function cmsPages(): Response
    {
        return $this->render('admin/cms-pages.html.twig');
    }

    #[Route('/cms/edit/{id?}', name: 'admin_cms_page_edit')]
    public function cmsPageEdit(?int $id = null): Response
    {
        return $this->render('admin/cms-page-editor.html.twig', [
            'pageId' => $id,
        ]);
    }
}
