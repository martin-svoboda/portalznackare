# INSYZ Stored Procedures

> **Reference** - Přehled všech INSYZ stored procedures s parametry a návratovými hodnotami

## 👤 Uživatelé

### trasy.WEB_Login
**Parametry:**
- `@Email` (varchar) - Email uživatele
- `@WEBPwdHash` (varchar) - SHA1 hash hesla

**Vrací:**
- `INT_ADR` (int) - Interní id uživatele

### trasy.ZNACKAR_DETAIL
**Parametry:**
- `INT_ADR` (int) - Interní adresa uživatele

**Vrací:** Multidataset s detailem značkaře (všechny datasety)

### trasy.WEB_Zapis_Pwd
**Parametry:**
- `@INT_ADR` (int) - Interní adresa uživatele
- `@WEBPwdHash` (varchar) - SHA1 hash nového hesla

**Vrací:** nic

## 📋 Příkazy

### trasy.PRIKAZY_SEZNAM
**Parametry:**
- `INT_ADR` (int) - Interní adresa uživatele
- `ROK` (int) - Rok příkazů

**Vrací:** Seznam příkazů pro uživatele

### trasy.ZP_Detail
**Parametry:**
- `ID_Znackarske_Prikazy` (int) - ID příkazu

**Vrací:** Multidataset s detailem příkazu (head, předměty, úseky)

### trasy.ZP_Zapis_XML
**Parametry:**
- `@XML_Data` (xml) - XML data hlášení
- `@Uzivatel` (varchar) - Uživatel odesílající hlášení

**Vrací:** nic

### trasy.ZP_Sazby
**Parametry:**
- `DATUM` (datetime) - Datum pro sazby

**Vrací:** Multidataset se sazbami pro dané datum

## ⚙️ Systém

### trasy.WEB_SystemoveParametry
**Parametry:** Žádné

**Vrací:** Seznam všech systémových parametrů

---

**Related Documentation:**
[INSYZ API](./insyz-api.md)
**Aktualizováno:** 2025-09-14