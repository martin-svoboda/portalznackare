# Authentication API Reference

> **API dokumentace** - Symfony Security autentifikace a session management pro přihlášení uživatelů

## 🔐 Přehled Authentication API

**Base URL:** `/api/auth/`  
**Účel:** Session-based autentifikace pomocí Symfony Security s INSYS integrací  
**Typ:** Session cookies (ne JWT)  
**Security:** CSRF protection, secure session handling

### Klíčové funkce
- **Symfony Security integrace:** Použití InsysAuthenticator  
- **Session management:** Automatické session cookies
- **User provider:** InsysUserProvider pro načítání uživatelských dat
- **Cross-origin support:** Proper CORS a cookie handling

## 📋 Endpointy

### 📊 GET `/api/auth/status`

Zkontroluje stav přihlášení aktuálního uživatele.

**Autentifikace:** Není vyžadována  
**Cookies:** Použije existující session cookie pokud existuje

**Response (přihlášený):**
```json
{
    "authenticated": true,
    "user": {
        "INT_ADR": 1234,
        "Jmeno": "Test",
        "Prijmeni": "Značkář",
        "Email": "test@test.com",
        "roles": ["ROLE_USER"]
    }
}
```

**Response (nepřihlášený):**
```json
{
    "authenticated": false,
    "user": null
}
```

**Backend implementace:**
```php
// src/Controller/Api/AuthController.php
public function status(): JsonResponse {
    $user = $this->getUser(); // Symfony Security
    
    if (!$user instanceof User) {
        return new JsonResponse([
            'authenticated' => false,
            'user' => null
        ]);
    }
    
    return new JsonResponse([
        'authenticated' => true,
        'user' => [
            'INT_ADR' => $user->getIntAdr(),
            'Jmeno' => $user->getJmeno(),
            'Prijmeni' => $user->getPrijmeni(),
            'Email' => $user->getEmail(),
            'roles' => $user->getRoles()
        ]
    ]);
}
```

**Chyby:**
- `500` - Chyba při načítání uživatelských dat

---

### 🔑 POST `/api/auth/login`

Endpoint pro přihlášení (zpracovává Symfony Security automaticky).

**Content-Type:** `application/json` nebo `application/x-www-form-urlencoded`

**Request (JSON):**
```json
{
    "username": "test",
    "password": "test"
}
```

**Request (Form data):**
```bash
curl -X POST "/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test&password=test"
```

**Response (úspěch):**
```json
{
    "success": true,
    "user": {
        "INT_ADR": 1234,
        "Jmeno": "Test",
        "Prijmeni": "Značkář", 
        "Email": "test@test.com",
        "roles": ["ROLE_USER"]
    },
    "message": "Přihlášení bylo úspěšné"
}
```

**Response (neúspěch):**
```json
{
    "success": false,
    "message": "Přihlášení se nezdařilo"
}
```

**Backend flow:**
```php
// 1. Symfony Security firewall zachytí request
// 2. InsysAuthenticator::authenticate() proces:
public function authenticate(Request $request): Passport {
    $credentials = $this->getCredentials($request);
    
    // Ověř přes INSYS/mock
    $intAdr = $this->insysService->loginUser($credentials['username'], $credentials['password']);
    
    // Vytvoř User object
    $user = $this->userProvider->loadUserByIdentifier($intAdr);
    
    return new SelfValidatingPassport(new UserBadge($intAdr));
}

// 3. Po úspěšném ověření AuthController::login() vrací response
```

**Security konfigurace:**
```yaml
# config/packages/security.yaml
firewalls:
    main:
        custom_authenticator: App\Security\InsysAuthenticator
        entry_point: App\Security\ApiAuthenticationEntryPoint
        logout:
            path: /api/auth/logout
            target: /
```

**Chyby:**
- `400` - Chybí nebo neplatné přihlašovací údaje
- `401` - Nesprávné username/password
- `500` - Chyba komunikace s INSYS

---

### 🚪 ANY `/api/auth/logout`

Odhlášení uživatele (zpracovává Symfony Security).

**Metody:** GET, POST, DELETE  
**Autentifikace:** Volitelná

**Response:** 
- Automatické přesměrování na `/` (homepage)
- Zneplatní session cookie

**Backend:**
```php  
// src/Controller/Api/AuthController.php
public function logout(): void {
    // Tato metoda se nikdy nespustí
    // Symfony firewall zachytí request a provede logout automaticky
    throw new \Exception('Symfony firewall měl zachytit logout.');
}
```

**Frontend použití:**
```javascript
// GET request pro logout
window.location.href = '/api/auth/logout';

// Nebo fetch pro AJAX logout
await fetch('/api/auth/logout', { 
    method: 'POST',
    credentials: 'same-origin' 
});
```

## 🔧 Backend komponenty

### **InsysAuthenticator** - Custom authenticator
```php
// src/Security/InsysAuthenticator.php  
class InsysAuthenticator extends AbstractAuthenticator {
    public function supports(Request $request): bool {
        return $request->isMethod('POST') 
            && $this->getLoginPath() === $request->getPathInfo();
    }
    
    public function authenticate(Request $request): Passport {
        // JSON nebo form data
        if ($request->getContentType() === 'json') {
            $data = json_decode($request->getContent(), true);
        } else {
            $data = $request->request->all();
        }
        
        $username = $data['username'] ?? $data['email'] ?? '';
        $password = $data['password'] ?? $data['hash'] ?? '';
        
        // Ověř přes InsysService
        $intAdr = $this->insysService->loginUser($username, $password);
        
        return new SelfValidatingPassport(
            new UserBadge($intAdr, [$this->userProvider, 'loadUserByIdentifier'])
        );
    }
}
```

### **InsysUserProvider** - User loading
```php
// src/Security/InsysUserProvider.php
class InsysUserProvider implements UserProviderInterface {
    public function loadUserByIdentifier(string $identifier): UserInterface {
        // $identifier = INT_ADR
        $userData = $this->insysService->getUser((int) $identifier);
        
        return new User(
            $userData['INT_ADR'],
            $userData['JMENO'] ?? '',
            $userData['PRIJMENI'] ?? '', 
            $userData['EMAIL'] ?? '',
            ['ROLE_USER']
        );
    }
}
```

### **ApiAuthenticationEntryPoint** - Error handling
```php
// src/Security/ApiAuthenticationEntryPoint.php
class ApiAuthenticationEntryPoint implements AuthenticationEntryPointInterface {
    public function start(Request $request, AuthenticationException $authException = null): Response {
        return new JsonResponse([
            'error' => 'Přístup odepřen',
            'message' => 'Přihlaste se prosím'
        ], Response::HTTP_UNAUTHORIZED);
    }
}
```

## 💻 Frontend integrace

### **React/JavaScript použití**
```javascript
// Login
const login = async (username, password) => {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // Důležité pro cookies
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    return data.success;
};

// Status check
const checkAuth = async () => {
    const response = await fetch('/api/auth/status', {
        credentials: 'same-origin'
    });
    const data = await response.json();
    return data.authenticated;
};

// Logout
const logout = () => {
    window.location.href = '/api/auth/logout';
};
```

### **Session persistence**
```javascript
// Session automaticky persistence across browser tabs
// Kontrola při načtení aplikace
useEffect(() => {
    checkAuth().then(isAuthenticated => {
        setUser(isAuthenticated ? data.user : null);
    });
}, []);

// Interceptor pro API calls
const apiCall = async (url, options = {}) => {
    const response = await fetch(url, {
        ...options,
        credentials: 'same-origin' // Vždy poslat cookies
    });
    
    if (response.status === 401) {
        // Redirect na login nebo zobraz login modal
        redirectToLogin();
    }
    
    return response;
};
```

## 🧪 Testování

### **Manual testing**
```bash
# 1. Check initial status (should be false)
curl -c cookies.txt "https://portalznackare.ddev.site/api/auth/status"

# 2. Login (saves session cookie)
curl -b cookies.txt -c cookies.txt -X POST "https://portalznackare.ddev.site/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test"}'

# 3. Check status again (should be true with user data)  
curl -b cookies.txt "https://portalznackare.ddev.site/api/auth/status"

# 4. Test protected endpoint
curl -b cookies.txt "https://portalznackare.ddev.site/api/insys/user"

# 5. Logout
curl -b cookies.txt "https://portalznackare.ddev.site/api/auth/logout"
```

### **Test credentials**
```bash
# Default test data (pokud USE_TEST_DATA=true)
{
    "username": "test",
    "password": "test"
}

# Nebo email format
{
    "username": "test@test.com", 
    "password": "test123"
}
```

## 🛠️ Troubleshooting

### **Session problémy**
- Zkontroluj `COOKIE_SECURE=false` pro HTTP development
- Ověř `SESSION_COOKIE_SAMESITE=lax` pro cross-origin
- Kontrola `credentials: 'same-origin'` ve fetch calls

### **CORS a cookies**
- Frontend a backend musí být na stejné doméně pro cookies
- Použij `credentials: 'same-origin'` nebo `credentials: 'include'`
- Zkontroluj CORS headers pro cookie support

### **Autentifikace selhává**
- Ověř `USE_TEST_DATA=true` pro development
- Zkontroluj INSYS connection pro produkci
- Kontrola InsysAuthenticator error logs

### **Development vs Production**
```php
// Development (mock data)
USE_TEST_DATA=true
// Credentials: test/test nebo test@test.com/test123

// Production (MSSQL)
USE_TEST_DATA=false
INSYS_DB_HOST=your-mssql-server
INSYS_DB_NAME=your-database
// Credentials: reálné INSYS login údaje
```

---

**Security konfigurace:** [../configuration/security.md](../configuration/security.md)  
**Funkcionální dokumentace:** [../features/authentication.md](../features/authentication.md)  
**API přehled:** [overview.md](overview.md)  
**Aktualizováno:** 2025-07-21