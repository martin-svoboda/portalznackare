# Hlášení práce

Hlášení práce slouží k nahlášení provedených prací na značkařských příkazech a k vyúčtování náhrad.

## Přístup k hlášení

K formuláři hlášení se dostanete:
1. Přejděte do sekce **Příkazy**
2. Otevřete detail konkrétního příkazu
3. V části **Hlášení příkazu** klikněte na **Vyplnit hlášení** (nebo **Upravit hlášení**, pokud už je rozpracované)

## Kdo může hlášení vyplnit

- Hlášení je **jedno společné pro celý tým** příkazu.
- Vyplňovat, ukládat a odesílat ho může jen **vedoucí týmu**. Ostatní členové týmu hlášení vidí, ale nemohou ho měnit.

## Struktura hlášení

Formulář má tři kroky, mezi kterými se přepínáte v horní části stránky:
1. **Část A - Vyúčtování** – doprava a výdaje
2. **Část B - Hlášení** – hlášení značkařské činnosti
3. **Souhrn** – kontrola a odeslání

Vpravo u části A je průběžný **Výpočet náhrad**, který se přepočítává při každé změně.

## Ukládání

- Rozpracované hlášení se **ukládá automaticky** několik sekund po každé změně.
- V části A můžete kdykoli uložit i ručně tlačítkem **Uložit změny**.
- K rozpracovanému hlášení se můžete kdykoli vrátit a pokračovat.

## Změna složení týmu

Pokud se po založení hlášení změní složení značkařů v příkazu, zobrazí se nad formulářem upozornění **„Složení značkařů v příkazu se neshoduje s uloženým hlášením."** s výpisem přidaných a odebraných značkařů.

Klikněte na **Načíst aktuální složení z příkazu**:
- odebraní značkaři zmizí ze skupin cest a z plátců nocležného a vedlejších výdajů,
- přidané značkaře je potom potřeba ručně zařadit do skupin cest.

## Vícedenní hlášení a nocležné

U každé cesty v části A vyplňujete **datum**. Pokud cesty spadají do **dvou a více různých dnů**, objeví se v části A sekce **Nocležné**.

Stravné i náhrady se počítají **za každý kalendářní den zvlášť** a pak se sečtou. Rozhoduje, zda vyplníte nocleh:
- **Bez noclehu** – každý den se počítá jako samostatný výjezd s návratem domů.
- **S noclehem** – dny se počítají jako souvislý pobyt: den odjezdu až do půlnoci, dny mezi tím celé a den návratu od půlnoci do příjezdu. Nocleh zadejte i tehdy, když jste za něj nic neplatili – stačí částka 0 Kč.

Nocležné přidáte tlačítkem **Přidat nocležné** a vyplníte:
- **Místo** a **Zařízení**
- **Částka (Kč)**
- **Uhradil** – kdo z týmu za nocleh zaplatil
- **Datum**
- **Doklady** – fotografie nebo PDF dokladu

Ve **Výpočtu náhrad** pak uvidíte stravné a náhrady rozepsané po jednotlivých dnech; dny uprostřed pobytu jsou označené *(celý den pobytu)*.

Aplikace vás může upozornit na možné chyby (hlášení tím není zablokováno):
- nocleh je vyplněný, ale všechny cesty jsou ve stejný den,
- datum noclehu je mimo rozsah dnů s cestami,
- cesty jsou ve více dnech, některý den nekončí návratem do výchozího místa a nocleh vyplněný není – pokud jste přespávali, doplňte nocleh (i nulový), jinak se dny počítají jako samostatné.

## Část B u příkazů na instalaci (ZP-I)

U příkazů na instalaci předmětů je v části B seznam **Turistická informační místa** – jedna karta pro každý TIM. Na kartě vidíte:
- číslo a název TIMu a štítky činností (**Instalace**, **Odinstalace**, **Servisní zásah**),
- počítadlo, kolik položek už má vyplněný stav (např. 2 / 3),
- tlačítko **Celý TIM proveden**, které označí všechny položky TIMu jako provedené najednou.

Po rozbalení karty (šipkou vlevo) vidíte jednotlivé položky v pořadí servis → odinstalace → instalace:
- u instalace náhled tabulky nebo směrovky,
- u odinstalace přeškrtnutý předmět,
- u servisního zásahu jeho popis.

U každé položky zvolte **Stav provedení**: **Provedena**, **Neprovedena** nebo **Odložena**. Ke každému TIMu můžete napsat **Komentář k TIMu** a přiložit **Fotografie k TIMu**.

**Kontroly před odesláním:**
- Pokud některá položka nemá stav provedení, hlášení nelze odeslat – aplikace vypíše, u kterých TIMů stav chybí.
- Pokud není žádný TIM označen jako provedený, aplikace upozorní, že náhrada za instalaci bude nulová.
- Pokud není určen řidič, aplikace upozorní, že se náhrada rozdělí rovným dílem.

### Náhrada za instalaci

- Náhrada se u instalace neřídí odpracovanými hodinami, ale **počtem provedených TIMů**. Započítá se každý TIM, který má alespoň jednu položku ve stavu **Provedena**; za „Neprovedena" a „Odložena" se nic nedostává.
- Výše náhrady se bere ze sazebníku KČT (v roce 2026: 1–4 TIMy 600 Kč, 5 a více TIMů při době práce alespoň 8 hodin 900 Kč).
- Náhrada se dělí: **2/3 řidiči**, zbylá 1/3 rovným dílem mezi ostatní členy týmu.
- Na náhradu mají nárok jen členové s příslušnou kvalifikací. Podíl člena bez nároku se rozdělí mezi ostatní, nepropadá.
- Stravné a jízdné se počítají stejně jako u ostatních příkazů.

Protože náhrada závisí na části B, je v části A nulová, dokud v části B nevyplníte provedené TIMy.

## Odeslání hlášení

1. V kroku **Souhrn** zkontrolujte souhrn části A i B.
2. Klikněte na **Odeslat ke schválení**. Tlačítko je aktivní, až když v části A ani B nejsou chyby.
3. Hlášení se odešle do systému INSYZ. Během odesílání se zobrazuje **„Odesílání do INSYZ probíhá..."** a formulář je uzamčen. Zpracování může trvat několik minut.

**Po odeslání už hlášení nelze upravovat.** V detailu příkazu se tlačítko změní na **Zobrazit hlášení**.

### Stavy po odeslání

- **Hlášení bylo úspěšně přijato** – INSYZ hlášení přijal a čeká na schválení.
- **Hlášení bylo schváleno** – hlášení je schválené.
- **Hlášení bylo zamítnuto** – při odesílání došlo k chybě nebo bylo hlášení zamítnuto. Hlášení se znovu odemkne: klikněte na **Upravit a odeslat znovu**, opravte údaje a odešlete ho znovu.

Pokud zpracování trvá neobvykle dlouho, aplikace doporučí obnovit stránku a stav zkontrolovat znovu.

## Přikládání souborů

K hlášení můžete přikládat dokumenty, fotografie a další soubory dokumentující provedenou práci – například jízdenky u cest, doklady k nocležnému nebo fotografie k TIMům.
