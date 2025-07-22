# Test API Reference

> **API dokumentace** - Development a debugging endpointy pro testování functionality a connection

## 🧪 Přehled Test API

**Base URL:** `/api/test/`  
**Účel:** Development nástroje pro testování, debugging a monitoring  
**Autentifikace:** Není vyžadována (pouze dev environment)  
**Environment:** Dostupné pouze v development módu

### Klíčové funkce
- **Connection testing:** MSSQL, services, external dependencies
- **Mock data access:** Přístup k test datům bez autentifikace
- **Debug info:** Environment variables, configuration state
- **Login flow testing:** Debug authentication procesu

## 📋 Endpointy

### 👤 GET `/api/test/insys-user`

Načte test uživatelská data z INSYS bez autentifikace.

**Request:**
```bash
GET /api/test/insys-user
```

**Response:**
```json
{
    "INT_ADR": 1234,
    "JMENO": "Test",
    "PRIJMENI": "Značkář",
    "EMAIL": "test@test.com",
    "KKZ": "Praha",
    "OBVOD": "1"
}
```

**Backend:**
```php
// src/Controller/Api/TestController.php
public function getInsysUser(): JsonResponse {
    try {
        // Hard-coded test INT_ADR
        $user = $this->insysService->getUser(1234);
        return new JsonResponse($user);
    } catch (Exception $e) {
        return new JsonResponse(['error' => $e->getMessage()], 500);
    }
}
```

**Usage:** Pro testování User provider, UI komponenty s user daty

---

### 📋 GET `/api/test/insys-prikazy`

Načte seznam test příkazů z INSYS bez autentifikace.

**Request:**
```bash
GET /api/test/insys-prikazy
```

**Response:**
```json
[
    {
        "ID_Znackarske_Prikazy": 123,
        "Cislo_ZP": "ZP001/2025",
        "Druh_ZP": "O",
        "Druh_ZP_Naz": "Obnova značení",
        "Stav_ZP_Naz": "Přidělený",
        "Popis_ZP": "Obnova značení Karlštejn",
        "Znackar": "Test Značkář",
        "Je_Vedouci": 1,
        "Vyuctovani": false
    }
]
```

**Backend:**
```php
public function getInsysPrikazy(): JsonResponse {
    try {
        // Hard-coded test parameters
        $prikazy = $this->insysService->getPrikazy(1234, 2025);
        return new JsonResponse($prikazy);
    } catch (Exception $e) {
        return new JsonResponse(['error' => $e->getMessage()], 500);
    }
}
```

**Usage:** Pro testování Material React Table, filtry, UI bez přihlášení

---

### 🔌 GET `/api/test/mssql-connection`

Testuje MSSQL připojení a konfiguraci.

**Request:**
```bash
GET /api/test/mssql-connection
```

**Response (test mode):**
```json
{
    "status": "test_mode",
    "message": "Using test data, MSSQL not tested",
    "config": {
        "USE_TEST_DATA": "true"
    }
}
```

**Response (production mode - success):**
```json
{
    "status": "success",
    "message": "MSSQL connection successful",
    "config": {
        "host": "your-mssql-server",
        "dbname": "your-database",
        "username": "your-user",
        "password": "***masked***"
    },
    "test_query": {
        "test": 1
    }
}
```

**Response (production mode - error):**
```json
{
    "status": "error",
    "message": "MSSQL connection failed: Connection timeout",
    "config": {
        "host": "your-mssql-server",
        "dbname": "your-database",
        "username": "your-user", 
        "password": "***masked***"
    }
}
```

**Backend logic:**
```php
public function testMSSQLConnection(): JsonResponse {
    $useTestData = $_ENV['USE_TEST_DATA'] ?? 'true';
    
    if ($useTestData === 'true') {
        return new JsonResponse([
            'status' => 'test_mode',
            'message' => 'Using test data, MSSQL not tested',
            'config' => ['USE_TEST_DATA' => $useTestData]
        ]);
    }
    
    try {
        // Test real MSSQL connection
        $host = $_ENV['INSYS_DB_HOST'] ?? 'not_set';
        $dbname = $_ENV['INSYS_DB_NAME'] ?? 'not_set';
        $username = $_ENV['INSYS_DB_USER'] ?? 'not_set';
        $password = $_ENV['INSYS_DB_PASS'] ?? 'not_set';
        
        $dsn = "sqlsrv:Server={$host};Database={$dbname}";
        $pdo = new \PDO($dsn, $username, $password);
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        
        // Test query
        $stmt = $pdo->query("SELECT 1 as test");
        $result = $stmt->fetch();
        
        return new JsonResponse([
            'status' => 'success',
            'message' => 'MSSQL connection successful',
            'config' => [
                'host' => $host,
                'dbname' => $dbname,
                'username' => $username,
                'password' => $password ? '***masked***' : 'not_set'
            ],
            'test_query' => $result
        ]);
        
    } catch (Exception $e) {
        return new JsonResponse([
            'status' => 'error',
            'message' => 'MSSQL connection failed: ' . $e->getMessage(),
            'config' => $config ?? []
        ], 500);
    }
}
```

**Usage:** Pro deployment verification, produkční setup debugging

---

### 🔑 POST `/api/test/login-test`

Testuje login mechanismus s debug informacemi.

**Content-Type:** `application/json`

**Request:**
```json
{
    "email": "test@test.com",
    "hash": "test123"
}
```

**Response (success):**
```json
{
    "status": "debug",
    "config": {
        "USE_TEST_DATA": "true",
        "email": "test@test.com",
        "hash_length": 7
    },
    "login_result": {
        "success": true,
        "int_adr": 1234
    }
}
```

**Response (error):**
```json
{
    "status": "error",
    "message": "Chyba přihlášení, zkontrolujte údaje a zkuste to znovu.",
    "config": {
        "USE_TEST_DATA": "true",
        "email": "test@test.com",
        "hash_length": 7
    }
}
```

**Backend:**
```php
public function testLogin(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), true);
    $email = $data['email'] ?? null;
    $hash = $data['hash'] ?? null;
    
    if (!$email || !$hash) {
        return new JsonResponse([
            'status' => 'error',
            'message' => 'Missing email or hash parameter'
        ], 400);
    }
    
    try {
        $useTestData = $_ENV['USE_TEST_DATA'] ?? 'true';
        
        $result = [
            'status' => 'debug',
            'config' => [
                'USE_TEST_DATA' => $useTestData,
                'email' => $email,
                'hash_length' => strlen($hash)
            ]
        ];
        
        // Test přes InsysService
        $intAdr = $this->insysService->loginUser($email, $hash);
        
        $result['login_result'] = [
            'success' => true,
            'int_adr' => $intAdr
        ];
        
        return new JsonResponse($result);
        
    } catch (Exception $e) {
        return new JsonResponse([
            'status' => 'error',
            'message' => $e->getMessage(),
            'config' => [
                'USE_TEST_DATA' => $useTestData ?? 'unknown',
                'email' => $email,
                'hash_length' => strlen($hash)
            ]
        ], 500);
    }
}
```

**Test credentials:**
```json
// Mock data credentials (USE_TEST_DATA=true)
{"email": "test@test.com", "hash": "test123"}

// Alternative format
{"email": "test", "hash": "test"}
```

**Usage:** Pro debugging authentication flow, environment troubleshooting

## 🔧 Development Usage

### **Quick health check**
```bash
# Kompletní health check scriptem
#!/bin/bash
echo "=== Portal značkaře API Health Check ==="

echo "1. Test user data:"
curl -s "https://portalznackare.ddev.site/api/test/insys-user" | jq -r '.JMENO // "ERROR"'

echo "2. Test příkazy:"  
curl -s "https://portalznackare.ddev.site/api/test/insys-prikazy" | jq -r 'length'

echo "3. Test MSSQL connection:"
curl -s "https://portalznackare.ddev.site/api/test/mssql-connection" | jq -r '.status'

echo "4. Test login:"
curl -s -X POST "https://portalznackare.ddev.site/api/test/login-test" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "hash": "test123"}' | jq -r '.login_result.success // false'
```

### **Frontend integration testing**
```javascript
// Test API availability před main app load
const testApiHealth = async () => {
    try {
        const tests = await Promise.all([
            fetch('/api/test/insys-user').then(r => r.json()),
            fetch('/api/test/insys-prikazy').then(r => r.json()),
            fetch('/api/test/mssql-connection').then(r => r.json())
        ]);
        
        console.log('API Health:', tests);
        return tests.every(test => !test.error);
    } catch (error) {
        console.error('API Health check failed:', error);
        return false;
    }
};

// Use v development módu
if (process.env.NODE_ENV === 'development') {
    testApiHealth().then(healthy => {
        if (!healthy) {
            console.warn('Some API endpoints are not working properly');
        }
    });
}
```

### **Automated testing**
```javascript
// Jest test example
describe('Test API', () => {
    test('should return test user data', async () => {
        const response = await fetch('/api/test/insys-user');
        const user = await response.json();
        
        expect(user).toHaveProperty('INT_ADR', 1234);
        expect(user).toHaveProperty('JMENO', 'Test');
        expect(user).toHaveProperty('EMAIL');
    });
    
    test('should return test příkazy list', async () => {
        const response = await fetch('/api/test/insys-prikazy'); 
        const prikazy = await response.json();
        
        expect(Array.isArray(prikazy)).toBe(true);
        expect(prikazy.length).toBeGreaterThan(0);
        expect(prikazy[0]).toHaveProperty('ID_Znackarske_Prikazy');
    });
    
    test('should handle login test', async () => {
        const response = await fetch('/api/test/login-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@test.com',
                hash: 'test123'
            })
        });
        
        const result = await response.json();
        expect(result.login_result.success).toBe(true);
        expect(result.login_result.int_adr).toBe(1234);
    });
});
```

## 📊 Monitoring a debugging

### **Environment detection**
```bash
# Rychlý způsob jak zjistit konfiguraci
curl -s "https://portalznackare.ddev.site/api/test/mssql-connection" | jq '{
    mode: .status,
    test_data: .config.USE_TEST_DATA,
    host: .config.host
}'
```

### **Performance testing**
```bash
# Response time test
time curl -s "https://portalznackare.ddev.site/api/test/insys-prikazy" > /dev/null

# Load test s více requestů
for i in {1..10}; do
    curl -s "https://portalznackare.ddev.site/api/test/insys-user" &
done
wait
```

### **Error debugging**
```bash
# Test různé error scenarios
curl "https://portalznackare.ddev.site/api/test/login-test" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email": "wrong@email.com", "hash": "wrong"}'

# Test missing parameters
curl "https://portalznackare.ddev.site/api/test/login-test" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🛡️ Security considerations

### **Production deployment**
```php
// DŮLEŽITÉ: Test API by mělo být disabled v produkci
// config/services.yaml
services:
    App\Controller\Api\TestController:
        tags: ['controller.service_arguments']
        # Condition pro povolení pouze v dev environment
        condition: '%kernel.debug%'
```

### **Access restrictions**
```yaml
# config/packages/security.yaml
access_control:
    # Test API pouze v dev módu
    - { path: ^/api/test, allow_if: "'dev' === env('APP_ENV')" }
```

### **Data exposure**
- Test API neobsahuje real production data
- Credentials jsou vždy masked v config response
- Hard-coded test values only

## 🧪 Common test scenarios

### **Development setup verification**
1. Test MSSQL connection status
2. Verify test data is loaded correctly
3. Check InsysService functionality
4. Validate authentication flow

### **CI/CD pipeline integration**
```yaml
# .github/workflows/tests.yml
- name: Test API health
  run: |
    curl --fail http://localhost/api/test/insys-user
    curl --fail http://localhost/api/test/mssql-connection
```

### **Production deployment check**
1. Verify test endpoints are disabled
2. MSSQL connection successful in prod mode
3. Real authentication works
4. No test data leaks

---

**API přehled:** [overview.md](overview.md)  
**Development workflow:** [../configuration/environment.md](../configuration/environment.md)  
**Aktualizováno:** 2025-07-21