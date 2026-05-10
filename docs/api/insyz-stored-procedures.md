# INSYZ Stored Procedures

> **Reference** - Přehled všech INSYZ stored procedures s parametry a návratovými hodnotami

## 👤 Uživatelé

### trasy.WEB_Login
**Parametry:**
- `@Email` (varchar) - Email uživatele
- `@WEBPwdHash` (varchar) - SHA1 hash hesla (uppercase hex)

**Vrací jediný řádek se sjednocenou strukturou (i při neúspěchu):**
- `INT_ADR` (int) - Interní id uživatele, **NULL pokud se přihlášení nezdařilo** (z bezpečnostních důvodů)
- `Email_nalezen` (1/0) - Email existuje v INSYZ
- `Heslo_se_shoduje` (1/0) - Hash hesla odpovídá uloženému
- `WEBUser` (1/0) - Uživatel má povolen přístup k webovému rozhraní
- `Zablokovano` (1/0) - Účet je zablokován
- `Platnost` (text) - Stav platnosti hesla (informativní, např. `OK`/`EXPIRED`)
- `Platnost_DO` (date) - Datum platnosti hesla
- `KontrolaPlatnostiPwdWEB` (1/0) - Vyžadovat kontrolu data platnosti

**Pravidlo úspěchu:** `INT_ADR != NULL && Email_nalezen=1 && Heslo_se_shoduje=1 && WEBUser=1 && Zablokovano=0` (a případně platná data, viz `KontrolaPlatnostiPwdWEB`).

> Sjednocená struktura nasazena na DEV v dubnu 2026. Portál implementuje graceful fallback (`isset()` guardy), takže funguje i proti starší verzi SP, která neposílá nové flagy.

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

### trasy.ZP_Useky
**Parametry:**
- `@ID_Znackarske_prikazy` (int) - ID značkařského příkazu

**Vrací:** Úseky příkazu (jeden dataset)

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
**Aktualizováno:** 2026-02-14