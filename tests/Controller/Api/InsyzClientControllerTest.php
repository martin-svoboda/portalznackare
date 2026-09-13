<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\InsyzClientController;
use App\Exception\InsyzClientAuthException;
use App\Service\InsyzClientCredentialsService;
use App\Service\InsyzClientThrottler;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class InsyzClientControllerTest extends TestCase
{
    private InsyzClientCredentialsService&MockObject $credentials;
    private InsyzClientThrottler $throttler;
    private AbstractLogger $logger;
    /** @var array<int, array{message: string, context: array}> */
    private array $logs = [];

    protected function setUp(): void
    {
        $this->credentials = $this->createMock(InsyzClientCredentialsService::class);
        $this->throttler = new InsyzClientThrottler(new ArrayAdapter(), 3, 900);
        $this->logs = [];

        $logs = &$this->logs;
        $this->logger = new class($logs) extends AbstractLogger {
            public function __construct(private array &$logs)
            {
            }

            public function log($level, $message, array $context = []): void
            {
                $this->logs[] = ['message' => (string) $message, 'context' => $context];
            }
        };
    }

    public function testReturnsPasswordForValidRequest(): void
    {
        $this->credentials->method('getDbPassword')
            ->with('znackar', 'Heslo123', 'db6273')
            ->willReturn('tajne-heslo');

        $response = $this->call(['user' => 'znackar', 'password' => 'Heslo123', 'key' => 'db6273']);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(['password' => 'tajne-heslo'], json_decode($response->getContent(), true));
    }

    /**
     * @dataProvider failureReasons
     */
    public function testAllFailuresShareTheSameResponse(string $reason): void
    {
        $this->credentials->method('getDbPassword')
            ->willThrowException(new InsyzClientAuthException($reason));

        $response = $this->call(['user' => 'znackar', 'password' => 'spatne', 'key' => 'db6273']);
        $body = json_decode($response->getContent(), true);

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame(['error' => 'Přístup byl odmítnut.'], $body);
    }

    public static function failureReasons(): array
    {
        return [
            [InsyzClientAuthException::REASON_UNKNOWN_KEY],
            [InsyzClientAuthException::REASON_UNKNOWN_USER],
            [InsyzClientAuthException::REASON_BAD_PASSWORD],
            [InsyzClientAuthException::REASON_ACCOUNT_NOT_VALID],
        ];
    }

    public function testDatabaseErrorAlsoReturnsGenericResponse(): void
    {
        $this->credentials->method('getDbPassword')
            ->willThrowException(new \RuntimeException('Database connection error: host unreachable'));

        $response = $this->call(['user' => 'znackar', 'password' => 'Heslo123', 'key' => 'db6273']);

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame(['error' => 'Přístup byl odmítnut.'], json_decode($response->getContent(), true));
    }

    /**
     * @dataProvider invalidPayloads
     */
    public function testInvalidPayloadIsRejectedWithoutCallingService(mixed $payload): void
    {
        $this->credentials->expects($this->never())->method('getDbPassword');

        $response = $this->call($payload);

        $this->assertSame(401, $response->getStatusCode());
    }

    public static function invalidPayloads(): array
    {
        return [
            'chybí key' => [['user' => 'znackar', 'password' => 'Heslo123']],
            'chybí user' => [['password' => 'Heslo123', 'key' => 'db6273']],
            'chybí password' => [['user' => 'znackar', 'key' => 'db6273']],
            'prázdné hodnoty' => [['user' => '', 'password' => '', 'key' => '']],
            'špatné typy' => [['user' => ['a'], 'password' => 1, 'key' => null]],
            'prázdné tělo' => [null],
        ];
    }

    public function testInsecureRequestIsRejectedWhenHttpsIsRequired(): void
    {
        $this->credentials->expects($this->never())->method('getDbPassword');

        $response = $this->call(
            ['user' => 'znackar', 'password' => 'Heslo123', 'key' => 'db6273'],
            requireHttps: true,
            secure: false
        );

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame('insecure_transport', $this->lastLog()['context']['reason']);
    }

    public function testFailedAttemptsLeadToThrottling(): void
    {
        $this->credentials->method('getDbPassword')
            ->willThrowException(new InsyzClientAuthException(InsyzClientAuthException::REASON_BAD_PASSWORD));

        for ($i = 0; $i < 3; $i++) {
            $this->call(['user' => 'znackar', 'password' => 'spatne', 'key' => 'db6273']);
        }

        $response = $this->call(['user' => 'znackar', 'password' => 'spatne', 'key' => 'db6273']);

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame('throttled', $this->lastLog()['context']['reason']);
    }

    public function testThrottledRequestNeverReachesService(): void
    {
        $this->throttler->registerFailure('user', 'znackar');
        $this->throttler->registerFailure('user', 'znackar');
        $this->throttler->registerFailure('user', 'znackar');

        $this->credentials->expects($this->never())->method('getDbPassword');

        $this->assertSame(401, $this->call([
            'user' => 'znackar',
            'password' => 'Heslo123',
            'key' => 'db6273',
        ])->getStatusCode());
    }

    public function testSuccessResetsThrottlingCounters(): void
    {
        $this->throttler->registerFailure('user', 'znackar');
        $this->throttler->registerFailure('user', 'znackar');

        $this->credentials->method('getDbPassword')->willReturn('tajne-heslo');

        $this->assertSame(200, $this->call([
            'user' => 'znackar',
            'password' => 'Heslo123',
            'key' => 'db6273',
        ])->getStatusCode());

        $this->assertFalse($this->throttler->isBlocked('user', 'znackar'));
    }

    public function testLogContainsRequiredFieldsAndNoPassword(): void
    {
        $this->credentials->method('getDbPassword')->willReturn('tajne-heslo-db');

        $this->call(['user' => 'znackar', 'password' => 'Heslo123', 'key' => 'db6273']);

        $log = $this->lastLog();
        $context = $log['context'];

        $this->assertSame('znackar', $context['user']);
        $this->assertSame('db6273', $context['key']);
        $this->assertSame('success', $context['result']);
        $this->assertSame('10.1.2.3', $context['ip']);
        $this->assertNotEmpty($context['time']);

        $serialized = json_encode([$log], JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString('Heslo123', $serialized);
        $this->assertStringNotContainsString('tajne-heslo-db', $serialized);
    }

    public function testFailedAttemptIsLoggedWithoutPassword(): void
    {
        $this->credentials->method('getDbPassword')
            ->willThrowException(new InsyzClientAuthException(InsyzClientAuthException::REASON_BAD_PASSWORD));

        $this->call(['user' => 'znackar', 'password' => 'Heslo123', 'key' => 'db6273']);

        $context = $this->lastLog()['context'];

        $this->assertSame('failure', $context['result']);
        $this->assertSame('bad_password', $context['reason']);
        $this->assertStringNotContainsString('Heslo123', json_encode($context, JSON_UNESCAPED_UNICODE));
    }

    private function call(mixed $payload, bool $requireHttps = false, bool $secure = true): JsonResponse
    {
        $controller = new InsyzClientController(
            $this->credentials,
            $this->throttler,
            $this->logger,
            $requireHttps
        );

        $request = Request::create(
            ($secure ? 'https' : 'http') . '://portal.test/api/insyz-client/db-password',
            'POST',
            [],
            [],
            [],
            [
                'REMOTE_ADDR' => '10.1.2.3',
                'CONTENT_TYPE' => 'application/json',
            ],
            $payload === null ? '' : json_encode($payload)
        );

        return $controller->dbPassword($request);
    }

    /**
     * @return array{message: string, context: array}
     */
    private function lastLog(): array
    {
        $this->assertNotEmpty($this->logs, 'Požadavek nebyl zalogován');

        return $this->logs[count($this->logs) - 1];
    }
}
