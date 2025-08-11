<?php

namespace App\Repository;

use App\Entity\SystemOption;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SystemOption>
 *
 * @method SystemOption|null find($id, $lockMode = null, $lockVersion = null)
 * @method SystemOption|null findOneBy(array $criteria, array $orderBy = null)
 * @method SystemOption[]    findAll()
 * @method SystemOption[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class SystemOptionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SystemOption::class);
    }

    public function save(SystemOption $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(SystemOption $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find option by name
     */
    public function findByName(string $optionName): ?SystemOption
    {
        return $this->findOneBy(['optionName' => $optionName]);
    }

    /**
     * Get option value by name
     */
    public function getValue(string $optionName, mixed $default = null): mixed
    {
        $option = $this->findByName($optionName);
        return $option ? $option->getOptionValue() : $default;
    }

    /**
     * Set option value (creates if doesn't exist)
     */
    public function setValue(string $optionName, mixed $value, bool $autoload = true): SystemOption
    {
        $option = $this->findByName($optionName);

        if (!$option) {
            $option = new SystemOption();
            $option->setOptionName($optionName);
            
            // Auto-enable autoload for audit and insyz_audit options if not explicitly set
            if ($autoload === true) {
                $autoload = str_starts_with($optionName, 'audit.') || str_starts_with($optionName, 'insyz_audit.');
            }
            
            $option->setAutoload($autoload);
        }

        $option->setOptionValue($value);
        $this->save($option, true);

        return $option;
    }

    /**
     * Get all autoload options (for caching)
     */
    public function findAutoloadOptions(): array
    {
        return $this->createQueryBuilder('o')
            ->where('o.autoload = :autoload')
            ->setParameter('autoload', true)
            ->orderBy('o.optionName', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get options as key-value array
     */
    public function getOptionsAsArray(bool $autoloadOnly = false): array
    {
        $qb = $this->createQueryBuilder('o');

        if ($autoloadOnly) {
            $qb->where('o.autoload = :autoload')
               ->setParameter('autoload', true);
        }

        $options = $qb->getQuery()->getResult();
        $result = [];

        foreach ($options as $option) {
            $result[$option->getOptionName()] = $option->getOptionValue();
        }

        return $result;
    }

    /**
     * Get audit configuration
     */
    public function getAuditConfiguration(): array
    {
        $auditEntities = $this->getValue('audit.log_entities', []);
        $retentionDays = $this->getValue('audit.retention_days', 90);
        $logIpAddresses = $this->getValue('audit.log_ip_addresses', true);

        return [
            'log_entities' => $auditEntities,
            'retention_days' => $retentionDays,
            'log_ip_addresses' => $logIpAddresses,
        ];
    }

    /**
     * Update audit entity configuration
     */
    public function updateAuditEntityConfig(string $entityName, array $config): void
    {
        $currentConfig = $this->getValue('audit.log_entities', []);
        $currentConfig[$entityName] = $config;
        $this->setValue('audit.log_entities', $currentConfig);
    }

    /**
     * Check if entity audit is enabled
     */
    public function isEntityAuditEnabled(string $entityName, string $event = null): bool
    {
        $auditEntities = $this->getValue('audit.log_entities', []);
        $entityConfig = $auditEntities[$entityName] ?? null;

        if (!$entityConfig || !($entityConfig['enabled'] ?? false)) {
            return false;
        }

        if ($event && isset($entityConfig['events']) && is_array($entityConfig['events'])) {
            return in_array($event, $entityConfig['events'], true);
        }

        return true;
    }

    /**
     * Get masked fields for entity
     */
    public function getMaskedFields(string $entityName): array
    {
        $auditEntities = $this->getValue('audit.log_entities', []);
        $entityConfig = $auditEntities[$entityName] ?? [];
        return $entityConfig['masked_fields'] ?? [];
    }

    /**
     * Search options by name pattern
     */
    public function searchByName(string $pattern): array
    {
        return $this->createQueryBuilder('o')
            ->where('o.optionName LIKE :pattern')
            ->setParameter('pattern', '%' . $pattern . '%')
            ->orderBy('o.optionName', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get audit-related options
     */
    public function getAuditOptions(): array
    {
        return $this->createQueryBuilder('o')
            ->where('o.optionName LIKE :pattern')
            ->setParameter('pattern', 'audit.%')
            ->orderBy('o.optionName', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Bulk update options
     */
    public function bulkUpdateOptions(array $options): void
    {
        $em = $this->getEntityManager();
        
        foreach ($options as $name => $value) {
            $option = $this->findByName($name);
            
            if (!$option) {
                $option = new SystemOption();
                $option->setOptionName($name);
                // Auto-enable autoload for audit and insyz_audit options
                $autoload = str_starts_with($name, 'audit.') || str_starts_with($name, 'insyz_audit.');
                $option->setAutoload($autoload);
            }
            
            $option->setOptionValue($value);
            $em->persist($option);
        }
        
        $em->flush();
    }
}