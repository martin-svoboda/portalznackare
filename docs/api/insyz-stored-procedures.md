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

**Vrací:** Multidataset s detailem příkazu (head, předměty, třetí dataset)

**Pozor na třetí dataset:** jeho obsah závisí na druhu příkazu.
- **ZP-O (druh `O`)** — úseky tras (`Kod_ZU`, `Nazev_ZU`, `Delka_ZU`, `Barva_Kod`, …)
- **ZP-I (druh `S`)** — servisní TIMy z `trasy.ZP_ServTIM` (`EvCi_TIM`, `Naz_TIM`, `Stav_TIM`,
  `Stav_Udrz`, `Stav_Udrz_Naz`, `TIM_Text`, `Popis`). Krátký text je `TIM_Text`,
  dlouhý popis (až 1000 znaků) je `Popis`. Dataset chybí, dokud servisní zásah není zadán.
  **Servisní TIMy jsou samostatné TIMy bez předmětů** — v datech nemají s TIMy z `predmety`
  žádný průnik. Úplný seznam TIMů příkazu je tedy sjednocení obou zdrojů a odpovídá výčtu
  v `head.Popis_ZP`.

Rozlišení dělá `DataEnricherService::jeServisniTimDataset()` (PHP) a `jeServisniTimDataset()`
v `assets/js/utils/prikaz.js` (JS) — podle přítomnosti `EvCi_TIM` a nepřítomnosti `Kod_ZU`.
Servisní řádky se ukládají do `servis_timy`, `useky` zůstávají prázdné.

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