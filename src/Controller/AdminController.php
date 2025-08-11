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
}