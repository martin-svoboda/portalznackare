<?php

namespace App\Entity;

use App\Repository\InsyzAuditLogRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: InsyzAuditLogRepository::class)]
#[ORM\Table(name: 'insyz_audit_logs')]
#[ORM\Index(columns: ['user_id', 'created_at'], name: 'idx_insyz_audit_user_created')]
#[ORM\Index(columns: ['endpoint', 'created_at'], name: 'idx_insyz_audit_endpoint_created')]
#[ORM\Index(columns: ['int_adr', 'created_at'], name: 'idx_insyz_audit_intadr_created')]
#[ORM\Index(columns: ['mssql_procedure', 'created_at'], name: 'idx_insyz_audit_procedure_created')]
#[ORM\Index(columns: ['status', 'created_at'], name: 'idx_insyz_audit_status_created')]
class InsyzAuditLog
{
    // Status constants
    public const STATUS_SUCCESS = 'success';
    public const STATUS_ERROR = 'error';
    public const STATUS_TIMEOUT = 'timeout';
    public const STATUS_CACHE_HIT = 'cache_hit';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['insyz_audit:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?User $user = null;

    #[ORM\Column(type: Types::INTEGER, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private int $intAdr;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private string $endpoint;

    #[ORM\Column(type: Types::STRING, length: 10, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private string $method;

    #[ORM\Column(type: Types::STRING, length: 100, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?string $mssqlProcedure = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?array $requestParams = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?array $responseSummary = null;

    #[ORM\Column(type: Types::BOOLEAN, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private bool $cacheHit = false;

    #[ORM\Column(type: Types::INTEGER, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private int $durationMs;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?int $mssqlDurationMs = null;

    #[ORM\Column(type: Types::STRING, length: 20, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private string $status;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?string $errorMessage = null;

    #[ORM\Column(type: Types::STRING, length: 45, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?string $ipAddress = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['insyz_audit:read'])]
    private ?string $userAgent = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: false)]
    #[Groups(['insyz_audit:read'])]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
        $this->status = self::STATUS_SUCCESS;
    }

    // Getters and setters

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;
        
        // Automatically set int_adr when user is set
        if ($user) {
            $this->intAdr = $user->getIntAdr();
        }

        return $this;
    }

    public function getIntAdr(): int
    {
        return $this->intAdr;
    }

    public function setIntAdr(int $intAdr): static
    {
        $this->intAdr = $intAdr;
        return $this;
    }

    public function getEndpoint(): string
    {
        return $this->endpoint;
    }

    public function setEndpoint(string $endpoint): static
    {
        $this->endpoint = $endpoint;
        return $this;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function setMethod(string $method): static
    {
        $this->method = strtoupper($method);
        return $this;
    }

    public function getMssqlProcedure(): ?string
    {
        return $this->mssqlProcedure;
    }

    public function setMssqlProcedure(?string $mssqlProcedure): static
    {
        $this->mssqlProcedure = $mssqlProcedure;
        return $this;
    }

    public function getRequestParams(): ?array
    {
        return $this->requestParams;
    }

    public function setRequestParams(?array $requestParams): static
    {
        $this->requestParams = $requestParams;
        return $this;
    }

    public function getResponseSummary(): ?array
    {
        return $this->responseSummary;
    }

    public function setResponseSummary(?array $responseSummary): static
    {
        $this->responseSummary = $responseSummary;
        return $this;
    }

    public function isCacheHit(): bool
    {
        return $this->cacheHit;
    }

    public function setCacheHit(bool $cacheHit): static
    {
        $this->cacheHit = $cacheHit;
        return $this;
    }

    public function getDurationMs(): int
    {
        return $this->durationMs;
    }

    public function setDurationMs(int $durationMs): static
    {
        $this->durationMs = $durationMs;
        return $this;
    }

    public function getMssqlDurationMs(): ?int
    {
        return $this->mssqlDurationMs;
    }

    public function setMssqlDurationMs(?int $mssqlDurationMs): static
    {
        $this->mssqlDurationMs = $mssqlDurationMs;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): static
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function setIpAddress(?string $ipAddress): static
    {
        $this->ipAddress = $ipAddress;
        return $this;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function setUserAgent(?string $userAgent): static
    {
        $this->userAgent = $userAgent;
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeInterface $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    /**
     * Helper methods for common operations
     */

    public function isSuccessful(): bool
    {
        return $this->status === self::STATUS_SUCCESS || $this->status === self::STATUS_CACHE_HIT;
    }

    public function isError(): bool
    {
        return in_array($this->status, [self::STATUS_ERROR, self::STATUS_TIMEOUT]);
    }

    public function getFormattedDuration(): string
    {
        if ($this->durationMs < 1000) {
            return $this->durationMs . 'ms';
        }
        
        return round($this->durationMs / 1000, 2) . 's';
    }

    public function getFormattedMssqlDuration(): ?string
    {
        if (!$this->mssqlDurationMs) {
            return null;
        }
        
        if ($this->mssqlDurationMs < 1000) {
            return $this->mssqlDurationMs . 'ms';
        }
        
        return round($this->mssqlDurationMs / 1000, 2) . 's';
    }

    /**
     * Create summary data from response (without storing full content)
     */
    public function createResponseSummary(mixed $responseData): array
    {
        if (!$responseData) {
            return ['empty' => true];
        }

        $summary = [];

        if (is_array($responseData)) {
            $summary['type'] = 'array';
            $summary['count'] = count($responseData);
            
            // If it's array of objects, analyze first item structure
            if (isset($responseData[0]) && is_array($responseData[0])) {
                $summary['item_keys'] = array_keys($responseData[0]);
                $summary['item_keys_count'] = count($summary['item_keys']);
            }
        } elseif (is_object($responseData)) {
            $summary['type'] = 'object';
            if (method_exists($responseData, '__toString')) {
                $summary['string_length'] = strlen((string)$responseData);
            }
        } elseif (is_string($responseData)) {
            $summary['type'] = 'string';
            $summary['length'] = strlen($responseData);
        } else {
            $summary['type'] = gettype($responseData);
        }

        // Calculate approximate size
        $summary['approximate_size'] = strlen(json_encode($responseData));

        return $summary;
    }

    /**
     * Sanitize request parameters (remove sensitive data)
     */
    public function sanitizeRequestParams(array $params): array
    {
        $sensitiveKeys = [
            'password', 'hash', 'token', 'key', 'secret',
            'WEBPwdHash', '@WEBPwdHash', 'auth', 'authorization'
        ];

        $sanitized = [];
        
        foreach ($params as $key => $value) {
            $lowerKey = strtolower($key);
            
            // Check if key contains sensitive information
            $isSensitive = false;
            foreach ($sensitiveKeys as $sensitiveKey) {
                if (str_contains($lowerKey, strtolower($sensitiveKey))) {
                    $isSensitive = true;
                    break;
                }
            }
            
            if ($isSensitive) {
                $sanitized[$key] = '[REDACTED]';
            } else {
                // For non-sensitive data, still limit size
                if (is_string($value) && strlen($value) > 255) {
                    $sanitized[$key] = substr($value, 0, 252) . '...';
                } else {
                    $sanitized[$key] = $value;
                }
            }
        }
        
        return $sanitized;
    }
}