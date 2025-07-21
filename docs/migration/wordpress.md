# Analýza migrace z WordPress pluginu

Porovnání původního WordPress pluginu (WP-src/) s našou Symfony implementací.

## 📋 Přehled původního WordPress systému

### **Architektura WP pluginu:**
```
Plugin.php                    # Main plugin class
├── Api/
│   ├── InsysApi.php          # INSYS/MSSQL API endpoints  
│   └── PortalApi.php         # Portal API endpoints
├── Models/
│   ├── MetodikaModel.php     # Metodika data model
│   └── ReportModel.php       # Report data model (hlášení)
├── PostTypes/
│   └── MetodikaPostType.php  # WordPress custom post type
├── Repositories/
│   ├── MetodikaRepository.php
│   └── ReportRepository.php
├── Taxonomies/
│   └── MetodikaTaxonomy.php  # WordPress taxonomy
└── portal/                   # React SPA
    ├── auth/                 # Autentifikace komponenty
    ├── prikazy/              # Příkazy komponenty
    ├── metodika/             # Metodika komponenty
    ├── downloads/            # Downloads komponenty
    └── user/                 # User dashboard
```

## 🔄 Srovnání implementací

### **1. Architektura**

| Aspekt | WordPress Plugin | Naše Symfony implementace |
|--------|------------------|---------------------------|
| **Typ** | SPA React v WP | Hybrid Twig + React micro-apps |
| **Routing** | React Router | Symfony routing + React islands |
| **State Management** | Global React context | Lokální state v micro-apps |
| **Backend** | WordPress REST API | Symfony API controllers |
| **Database** | WordPress + custom tables | Doctrine ORM entities |
| **File Management** | WordPress Media Library | Custom file management systém |

### **2. Autentifikace**

**WordPress:**
```php
// WP session based
wp_verify_nonce($nonce, 'wp_rest');
is_user_logged_in();
```

**Naše implementace:**
```php
// Symfony Security
class InsysAuthenticator implements AuthenticatorInterface
class InsysUserProvider implements UserProviderInterface
```

### **3. File Upload System**

**WordPress (chybí v původním pluginu):**
- Používá WordPress Media Library
- Základní upload bez pokročilých funkcí
- Žádné hash tokeny pro security

**Naše implementace:**
```php
class FileUploadService {
    // ✅ Hash-based deduplication
    // ✅ Public/private file distinction  
    // ✅ Usage tracking
    // ✅ Soft delete with grace period
    // ✅ Thumbnail generation
    // ✅ Security tokens in URLs
}
```

## ✅ Co už máme implementováno

### **Backend API parity:**

| Endpoint | WordPress | Symfony | Status |
|----------|-----------|---------|--------|
| Login | `/wp-json/portal/v1/login` | `/api/insys/login` | ✅ |
| User info | `/wp-json/insys/v1/user` | `/api/insys/user` | ✅ |
| Příkazy list | `/wp-json/insys/v1/prikazy` | `/api/insys/prikazy` | ✅ |
| Příkaz detail | `/wp-json/insys/v1/prikaz/{id}` | `/api/insys/prikaz/{id}` | ✅ |
| Report GET | `/wp-json/portal/v1/report` | `/api/portal/report` | ✅ |
| Report POST | `/wp-json/portal/v1/report` | `/api/portal/report` | ✅ |
| Metodika terms | `/wp-json/portal/v1/metodika-terms` | `/api/portal/methodologies` | ✅ |
| Downloads | `/wp-json/portal/v1/downloads` | `/api/portal/downloads` | ✅ |

### **Frontend komponenty:**

| Komponenta | WordPress | Symfony | Status |
|------------|-----------|---------|--------|
| Login form | `auth/LoginForm.tsx` | `assets/js/components/auth/LoginForm.tsx` | ✅ |
| User widget | `auth/UserWidget.tsx` | `assets/js/components/auth/UserWidget.tsx` | ✅ |
| Příkazy list | `prikazy/Prikazy.tsx` | `assets/js/apps/prikazy/App.jsx` | ✅ |
| Hlášení form | `prikazy/HlaseniPrikazu.tsx` | `assets/js/apps/hlaseni-prikazu/App.jsx` | ✅ |
| Part A form | `prikazy/components/PartAForm.tsx` | `assets/js/apps/hlaseni-prikazu/components/PartAForm.jsx` | ✅ |
| Part B form | `prikazy/components/PartBForm.tsx` | `assets/js/apps/hlaseni-prikazu/components/PartBForm.jsx` | ✅ |
| File upload | `prikazy/components/FileUploadZone.tsx` | `assets/js/apps/hlaseni-prikazu/components/AdvancedFileUpload.jsx` | ✅ |
| Dashboard | `user/Dashboard.tsx` | `templates/pages/dashboard.html.twig` | ✅ |

## 🔍 Co nám chybí oproti WP pluginu

### **1. Metodika systém**

**WordPress implementace:**
```php
// Custom Post Type + Taxonomy
class MetodikaPostType extends AbstractCustomPostType
class MetodikaTaxonomy 
class MetodikaRepository

// API endpoints
GET /wp-json/portal/v1/metodika
GET /wp-json/portal/v1/metodika-terms
```

**Naše implementace:**
```php
// ❌ Chybí kompletní metodika systém
// ❌ Nemáme Doctrine entity pro metodiky
// ❌ Nemáme kategorie/taxonomie
// ❌ Chybí admin rozhraní pro správu metodik
```

### **2. Downloads systém**

**WordPress:**
```php
// Nastavení v admin panelu
$this->settings->get_option('downloads');
// API vrací kategorie + soubory
public function get_downloads($request)
```

**Naše implementace:**
```php
// ✅ Máme mock API endpoint
// ❌ Chybí databázové entity
// ❌ Chybí admin rozhraní pro správu
```

### **3. Static content systém**

**WordPress:**
```php
// Post/Page content přes WP API
public function get_post_data($request) {
    // WordPress posts/pages
    // Dynamic content loading
}
```

**Naše implementace:**
```twig
{# ✅ Máme statické Twig templaty #}
{# ❌ Chybí dynamické content loading #}
{# ❌ Nemáme CMS pro editaci obsahu #}
```

## 🚀 Priority pro doplnění

### **Vysoká priorita**

#### **1. Metodika systém**
```php
// Potřebujeme implementovat:
class Metodika extends AbstractEntity
class MetodikaCategory extends AbstractEntity  
class MetodikaRepository
class MetodikaController

// + admin rozhraní pro:
- Vytváření/editace metodik
- Kategorizace 
- Upload PDF souborů
- Publikování/draft
```

#### **2. Downloads systém**
```php
// Rozšířit stávající file management:
class Download extends AbstractEntity
class DownloadCategory extends AbstractEntity

// + admin rozhraní pro:
- Kategorie ke stažení
- Upload souborů
- Organizace do kategorií
```

### **Střední priorita**

#### **3. Content Management**
```php
// Pro editovatelný obsah:
class Page extends AbstractEntity
class PageController

// Nebo integrace s:
- Existing CMS (pokud potřeba)
- Static file based content
```

#### **4. Admin rozhraní**
```twig
{# /admin dashboard s: #}
- Správa metodik
- Správa downloads  
- Správa souborů (už máme v plánu)
- Uživatelé a oprávnění
```

### **Nízká priorita**

#### **5. WordPress parity features**
- Custom taxonomie systém
- WordPress-style shortcodes
- Gutenberg blocks equivalent

## 📊 Funkční pokrytí

### **✅ Kompletně implementováno (90%+)**
- Autentifikace systém
- INSYS API integrace  
- Hlášení příkazů (Part A + B)
- File upload s pokročilými funkcemi
- Uživatelské rozhraní

### **🔶 Částečně implementováno (30-70%)**
- Downloads API (mock data)
- Static content (Twig templaty)

### **❌ Chybí kompletně (0%)**
- Metodika management systém
- Downloads management systém  
- Content management systém
- Admin rozhraní pro správu

## 🎯 Doporučený postup implementace

### **Fáze 1: Core Missing Features**
1. **Metodika entities + repository**
2. **Downloads entities + repository** 
3. **Basic admin rozhraní**

### **Fáze 2: Admin Interface**
1. **Metodika management UI**
2. **Downloads management UI**
3. **File management UI** (už v TODO.md)

### **Fáze 3: Polish & Advanced**
1. **Content management** (pokud potřeba)
2. **Advanced admin features**
3. **WordPress import tool** (migrace dat)

## 💡 Architektural Insights

### **Naše výhody oproti WP:**
- ✅ **Lepší file management** - hash security, usage tracking
- ✅ **Type safety** - Doctrine entities vs WP arrays
- ✅ **Better performance** - micro-apps vs SPA
- ✅ **Security** - Symfony Security vs WP auth
- ✅ **Maintainability** - clean architecture

### **Co si můžeme vypůjčit z WP:**
- 📋 **API struktura** - endpoint naming conventions  
- 📋 **Data models** - entity field definitions
- 📋 **Admin UI patterns** - management interfaces
- 📋 **File organization** - kategorie a taxonomie

---

**Celkový stav:** Máme silný základ s pokročilým file managementem, ale chybí nám content management část (metodiky, downloads). Priority jsou jasné a implementace je straightforward.