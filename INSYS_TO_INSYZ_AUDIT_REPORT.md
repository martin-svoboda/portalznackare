# INSYS → INSYZ Rename Audit Report

## 📋 Executive Summary

**Celkový rozsah:** 31 souborů obsahuje "insys" nebo "INSYS"  
**Kritické API endpointy:** `/api/insys/*` používané frontendovými aplikacemi  
**Environment variables:** `INSYS_DB_*` používané v produkci  
**Riziko:** **STŘEDNÍ** - Změna API endpointů vyžaduje koordinovaný deployment

## 🚨 Breaking Changes (Kritické)

### 1. **API Endpoints** - Frontend závislosti
```php
// Current: /api/insys/*
#[Route('/api/insys')]
class InsysController extends AbstractController {
    // /api/insys/login
    // /api/insys/user  
    // /api/insys/prikazy
    // /api/insys/prikaz/{id}
    // /api/insys/ceniky
}
```

**Dopad:** Všechny React aplikace přestanou fungovat  
**Affected files:** 
- `assets/js/utils/api.js` 
- `assets/js/apps/hlaseni-prikazu/` (multiple files)
- `assets/js/apps/prikazy/` (multiple files)

### 2. **Environment Variables** - Production config
```bash
# Current production vars
INSYS_DB_HOST=production.server.com
INSYS_DB_NAME=INSYS_DATABASE  
INSYS_DB_USER=portal_user
INSYS_DB_PASS=secure_password
```

**Dopad:** Produkční databázové připojení přestane fungovat  
**Affected systems:** DEV, STAGING, PRODUCTION

### 3. **Class Names** - PHP autoloading
```php
// Current classes
InsysController.php
InsysService.php  
InsysAuthenticator.php
InsysUserProvider.php
InsysTestController.php
```

**Dopad:** Composer autoload regenerace nutná

## 📁 Affected File Categories

### Backend PHP (11 files)
- ✅ `src/Controller/Api/InsysController.php` - **CRITICAL** (API routes)
- ✅ `src/Service/InsysService.php` - **HIGH** (core service)  
- ✅ `src/Security/InsysAuthenticator.php` - **HIGH** (authentication)
- ✅ `src/Security/InsysUserProvider.php` - **HIGH** (user provider)
- ✅ `src/Controller/InsysTestController.php` - LOW (dev only)
- ✅ `src/MessageHandler/SendToInsyzHandler.php` - **MEDIUM** (already correct!)
- ⚠️ `src/Service/MssqlConnector.php` - **HIGH** (env vars)
- ⚠️ `src/Controller/Api/TestController.php` - **MEDIUM** (test endpoints)

### Frontend JavaScript (5 files)  
- ✅ `assets/js/utils/api.js` - **CRITICAL** (API calls)
- ✅ `assets/js/apps/hlaseni-prikazu/hooks/usePriceList.js` - **HIGH**
- ⚠️ `assets/js/apps/insys-tester/` - **LOW** (dev tool)
- ⚠️ `webpack.config.js` - **LOW** (build config)

### Templates (1 file)
- ⚠️ `templates/pages/insys-test.html.twig` - **LOW** (dev page)

### Configuration (5 files)
- ✅ `.env` - **HIGH** (local config)  
- ✅ `.env.local.example` - **MEDIUM** (documentation)
- ✅ `.github/workflows/deploy.yml` - **CRITICAL** (production deployment)
- ⚠️ Configuration files in `/docs/` - **LOW** (documentation only)

### Documentation (15 files)
- All `.md` files in `/docs/` - **LOW** (documentation only, safe to update)

## 🔄 Migration Strategy 

### Phase 1: Preparation (SAFE)
1. ✅ Update documentation files (15 files) 
2. ✅ Update class name references in comments/docs
3. ✅ Update `.env.local.example` 

### Phase 2: Backend Breaking Changes (REQUIRES COORDINATION)
1. 🔴 **Environment variables** - Update production `.env.local`
   ```bash
   # OLD → NEW
   INSYS_DB_* → INSYZ_DB_*
   ```

2. 🔴 **Class renames** - Requires composer dump-autoload
   ```bash
   # OLD → NEW  
   InsysController → InsyzController
   InsysService → InsyzService
   InsysAuthenticator → InsyzAuthenticator
   InsysUserProvider → InsyzUserProvider
   ```

3. 🔴 **API Routes** - Breaking change for frontend
   ```bash
   # OLD → NEW
   /api/insys/* → /api/insyz/*
   ```

### Phase 3: Frontend Updates (MUST BE SYNCHRONIZED)
1. 🔴 Update `assets/js/utils/api.js` - All API calls
2. 🔴 Update React applications - API endpoint references
3. 🔴 Update webpack entries

### Phase 4: Infrastructure
1. 🔴 Update deployment workflows
2. 🔴 Update production environment variables
3. 🔴 Clear/update any cached configurations

## ⚠️ Deployment Risks

### High Risk Items:
1. **API Endpoint changes** - Frontend apps will break until both deployed
2. **Environment variables** - Database connections will fail  
3. **Class name changes** - Autoloader issues until `composer dump-autoload`
4. **Cached routes** - Symfony route cache needs clearing

### Mitigation Strategies:

#### Option A: Big Bang Deployment  
- ✅ **Pros:** Clean, complete rename
- ❌ **Cons:** Brief downtime, higher risk
- **Process:** Deploy everything at once + clear caches

#### Option B: Backward Compatibility (Recommended)
```php  
// Temporary: Support both old and new routes
#[Route('/api/insys')]  // Keep old
#[Route('/api/insyz')]  // Add new
class InsyzController extends AbstractController {
    // Gradually migrate frontend apps
}
```

#### Option C: Staged Migration
1. **Week 1:** Backend changes + dual API support
2. **Week 2:** Frontend gradual migration  
3. **Week 3:** Remove old API endpoints
4. **Week 4:** Clean up old environment variables

## 🧪 Testing Requirements

### Pre-deployment Testing:
```bash
# Environment variable changes
ddev restart  # Test local environment
curl /api/insyz/user  # Test new endpoints

# Class loading
composer dump-autoload  # Regenerate autoloader
bin/console cache:clear  # Clear Symfony caches

# Frontend 
npm run build  # Test webpack builds
curl /api/insyz/prikazy  # Test API endpoints
```

## 💰 Effort Estimation

### Development Time:
- **Documentation updates:** 30 minutes (low risk)
- **Backend class renames:** 1 hour (medium risk)  
- **API endpoint changes:** 2 hours (high risk)
- **Frontend API calls:** 1 hour (high risk)
- **Environment variable updates:** 30 minutes (high risk)
- **Testing & deployment:** 2 hours (high risk)

**Total:** ~7 hours development + deployment coordination

### Deployment Coordination:
- **Production environment variables** - Server admin required
- **Deployment timing** - Must be coordinated (no partial deployments)
- **Rollback plan** - Must be prepared

## 📋 Pre-Migration Checklist

### Before Starting:
- [ ] Backup production database 
- [ ] Document current environment variables
- [ ] Test deployment process on staging
- [ ] Prepare rollback scripts
- [ ] Coordinate with server admins
- [ ] Plan maintenance window (if needed)

### Critical Files to Update:
- [ ] `src/Controller/Api/InsysController.php` → `InsyzController.php`
- [ ] `src/Service/InsysService.php` → `InsyzService.php`
- [ ] `assets/js/utils/api.js` - Update API base URLs
- [ ] `.env` and production environment files
- [ ] `.github/workflows/deploy.yml` 
- [ ] All PHP imports/references to renamed classes

## 🎯 Recommendation

**DOPORUČENÍ:** **Option B - Backward Compatibility Approach**

1. **Immediate (Safe):** Update documentation and comments
2. **Phase 1:** Add new API routes alongside old ones  
3. **Phase 2:** Update environment variables (coordinate with ops)
4. **Phase 3:** Gradually migrate frontend applications
5. **Phase 4:** Remove old API routes after 2-3 weeks

**Reasoning:** 
- ✅ Minimizes downtime risk
- ✅ Allows gradual testing
- ✅ Easy rollback if issues found  
- ✅ Can be done without maintenance window

---

**Created:** 2025-08-06  
**Status:** Ready for implementation  
**Risk Level:** MEDIUM (with mitigation strategies)