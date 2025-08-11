<?php

namespace App\Repository;

use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @extends ServiceEntityRepository<User>
 *
 * @method User|null find($id, $lockMode = null, $lockVersion = null)
 * @method User|null findOneBy(array $criteria, array $orderBy = null)
 * @method User[]    findAll()
 * @method User[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class UserRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function save(User $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(User $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find user by INT_ADR
     */
    public function findByIntAdr(int $intAdr): ?User
    {
        return $this->findOneBy(['intAdr' => $intAdr]);
    }

    /**
     * Find user by email
     */
    public function findByEmail(string $email): ?User
    {
        return $this->findOneBy(['email' => $email]);
    }

    /**
     * Find or create user from INSYZ data
     */
    public function findOrCreateFromInsyzData(array $insyzData): User
    {
        $intAdr = (int)($insyzData['INT_ADR'] ?? 0);
        
        if (!$intAdr) {
            throw new \InvalidArgumentException('Invalid INT_ADR in INSYZ data');
        }

        $user = $this->findByIntAdr($intAdr);
        
        if (!$user) {
            // Create new user
            $user = User::createFromInsyzData($insyzData);
            $this->save($user);
        } else {
            // Update existing user
            $user->updateFromInsyzData($insyzData);
        }
        
        // Update last login
        $user->setLastLoginAt(new \DateTimeImmutable());
        $this->save($user, true);
        
        return $user;
    }

    /**
     * Find all active users with specific role
     */
    public function findByRole(string $role): array
    {
        return $this->createQueryBuilder('u')
            ->where('u.isActive = :active')
            ->andWhere('JSONB_EXISTS_ANY(u.roles, ARRAY[:role])')
            ->setParameter('active', true)
            ->setParameter('role', $role)
            ->orderBy('u.prijmeni', 'ASC')
            ->addOrderBy('u.jmeno', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all admin users
     */
    public function findAdmins(): array
    {
        return $this->createQueryBuilder('u')
            ->where('u.isActive = :active')
            ->andWhere('(u.roles @> :roleAdmin OR u.roles @> :roleSuperAdmin)')
            ->setParameter('active', true)
            ->setParameter('roleAdmin', json_encode(['ROLE_ADMIN']))
            ->setParameter('roleSuperAdmin', json_encode(['ROLE_SUPER_ADMIN']))
            ->orderBy('u.prijmeni', 'ASC')
            ->addOrderBy('u.jmeno', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find recently active users
     */
    public function findRecentlyActive(int $days = 30): array
    {
        $since = new \DateTimeImmutable("-{$days} days");
        
        return $this->createQueryBuilder('u')
            ->where('u.isActive = :active')
            ->andWhere('u.lastLoginAt >= :since')
            ->setParameter('active', true)
            ->setParameter('since', $since)
            ->orderBy('u.lastLoginAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Search users by name or email
     */
    public function search(string $query): array
    {
        $query = '%' . trim($query) . '%';
        
        return $this->createQueryBuilder('u')
            ->where('u.isActive = :active')
            ->andWhere('(u.jmeno LIKE :query OR u.prijmeni LIKE :query OR u.email LIKE :query OR CAST(u.intAdr AS TEXT) LIKE :query)')
            ->setParameter('active', true)
            ->setParameter('query', $query)
            ->orderBy('u.prijmeni', 'ASC')
            ->addOrderBy('u.jmeno', 'ASC')
            ->setMaxResults(50)
            ->getQuery()
            ->getResult();
    }

    /**
     * Get user statistics
     */
    public function getStatistics(): array
    {
        $qb = $this->createQueryBuilder('u');
        
        $totalUsers = $this->count(['isActive' => true]);
        
        $roleStats = $this->createQueryBuilder('u')
            ->select('u.roles')
            ->where('u.isActive = :active')
            ->setParameter('active', true)
            ->getQuery()
            ->getResult();
        
        $roleCounts = [
            'ROLE_USER' => 0,
            'ROLE_VEDOUCI' => 0,
            'ROLE_ADMIN' => 0,
            'ROLE_SUPER_ADMIN' => 0,
        ];
        
        foreach ($roleStats as $userRoles) {
            foreach ($userRoles['roles'] as $role) {
                if (isset($roleCounts[$role])) {
                    $roleCounts[$role]++;
                }
            }
        }
        
        $lastWeek = new \DateTimeImmutable('-7 days');
        $activeLastWeek = $this->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.isActive = :active')
            ->andWhere('u.lastLoginAt >= :lastWeek')
            ->setParameter('active', true)
            ->setParameter('lastWeek', $lastWeek)
            ->getQuery()
            ->getSingleScalarResult();
        
        return [
            'total_users' => $totalUsers,
            'active_last_week' => $activeLastWeek,
            'role_counts' => $roleCounts,
        ];
    }
}