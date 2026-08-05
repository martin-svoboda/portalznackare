import {toISODateString} from '../../../utils/dateUtils.js';
import {log} from '../../../utils/debug';
import { budujUcetniDny, naIsoDatum } from './vicedenniVypocet.js';

/**
 * Kvalifikace opravňující k náhradě za práci (dohodnuto s INSYZ):
 *   ZZ – Zaškolený značkař, VZ – Vedoucí značkař, IZ – Instruktor značení, ZT.
 * Pozor: vyšší kvalifikace (VZ) NEMÁ v INSYZ datech samostatný ZZ záznam, ale nárok má –
 * proto se kontroluje celá množina, ne jen doslovné "ZZ".
 */
export const KVALIFIKACE_S_NAROKEM_NA_NAHRADY = ['ZZ', 'VZ', 'IZ', 'ZT'];

/**
 * Kontrola, zda má uživatel kvalifikaci opravňující k náhradě za práci.
 * @param {Object} usersDetails - Data uživatelů z API (usersDetails[INT_ADR])
 * @param {number} userIntAdr - INT_ADR uživatele ke kontrole
 * @returns {boolean}
 */
export function maNarokNaNahrady(usersDetails, userIntAdr) {
    if (!usersDetails || !userIntAdr) {
        return false;
    }

    const userData = usersDetails[userIntAdr];
    if (!userData || !Array.isArray(userData)) {
        return false;
    }

    // Index 2 obsahuje kvalifikace
    const kvalifikace = userData[2];
    if (!Array.isArray(kvalifikace)) {
        return false;
    }

    return kvalifikace.some(kval => KVALIFIKACE_S_NAROKEM_NA_NAHRADY.includes(kval.Zkratka_Kval));
}

/**
 * Parse tariff rates from API response - zpracování ze sazebníku
 */
export function parseTariffRatesFromAPI(apiData) {
    if (!apiData) return null;
    
    // Pole "1" - Jízdné sazby
    const jizdneData = apiData["1"] || [];
    const zakladni = jizdneData.find(item => item.Druh_AUV === "AUVN");
    const zvysena = jizdneData.find(item => item.Druh_AUV === "AUVV");
    
    return {
        jizdne: parseFloat(zakladni?.Sazba_Kc || 0),
        jizdneZvysene: parseFloat(zvysena?.Sazba_Kc || 0),
        stravneTariffs: apiData["0"] || [],
        nahradyTariffs: apiData["2"] || []
    };
}

/**
 * Výpočet data provedení z nejpozdějšího data segmentů
 */
export function calculateExecutionDate(formData) {
    let latestDate = null;
    
    // Najít nejpozdější datum ze všech segmentů
    formData.Skupiny_Cest?.forEach(group => {
        group.Cesty?.forEach(segment => {
            if (segment.Datum) {
                const segmentDate = segment.Datum instanceof Date ? segment.Datum : new Date(segment.Datum);
                if (!isNaN(segmentDate.getTime()) && (!latestDate || segmentDate > latestDate)) {
                    latestDate = segmentDate;
                }
            }
        });
    });
    
    return latestDate || new Date();
}

/**
 * Výpočet pracovních dnů pro konkrétního uživatele
 * Vrací array dnů s detailními časy Od/Do/Hodin pro uživatele podle jeho účasti ve skupinách
 */
export function calculateWorkDays(formData, userIntAdr) {
    if (!userIntAdr || !formData.Skupiny_Cest) return [];
    
    // Najít všechny skupiny kde je uživatel cestujícím
    const userGroups = formData.Skupiny_Cest.filter(group => 
        group.Cestujci && group.Cestujci.includes(userIntAdr)
    );
    
    if (userGroups.length === 0) return [];
    
    // Extraktovat segmenty pouze ze skupin kde uživatel cestuje
    const userSegments = userGroups.flatMap(group => group.Cesty || []);
    
    if (userSegments.length === 0) return [];
    
    // Seskupit segmenty podle dne
    const segmentsByDate = userSegments.reduce((acc, segment) => {
        if (!segment || !segment.Cas_Odjezdu || !segment.Cas_Prijezdu) return acc;
        
        // Použít segment.Datum pokud existuje, jinak aktuální datum jako fallback
        let segmentDate = segment.Datum || new Date();
        
        // Zajistit, že segmentDate je Date objekt
        if (!(segmentDate instanceof Date)) {
            segmentDate = new Date(segmentDate);
        }
        
        // Pokud je datum neplatné, použít aktuální datum
        if (isNaN(segmentDate.getTime())) {
            segmentDate = new Date();
        }
        
        const dateKey = segmentDate.toDateString();
        
        if (!acc[dateKey]) {
            acc[dateKey] = {
                date: segmentDate,
                segments: []
            };
        }
        acc[dateKey].segments.push(segment);
        return acc;
    }, {});
    
    // Spočítat hodiny pro každý den a vytvořit Dny_Prace array
    return Object.entries(segmentsByDate).map(([dateStr, dayData]) => {
        const { date, segments } = dayData;
        
        // Najít nejdřívější čas začátku a nejpozdější čas konce
        // Použít správný formát data bez časové zóny - yyyy-mm-dd HH:mm
        let earliestTime = null;
        let latestTime = null;
        let segOdjezd = null;   // segment s nejdřívějším odjezdem
        let segPrijezd = null;  // segment s nejpozdějším příjezdem

        segments.forEach(s => {
            if (s.Cas_Odjezdu && (!earliestTime || s.Cas_Odjezdu < earliestTime)) {
                earliestTime = s.Cas_Odjezdu;
                segOdjezd = s;
            }
            if (s.Cas_Prijezdu && (!latestTime || s.Cas_Prijezdu > latestTime)) {
                latestTime = s.Cas_Prijezdu;
                segPrijezd = s;
            }
        });
        
        // Zajistit, že date je Date objekt před voláním toISOString()
        let dateObj = date;
        if (!(dateObj instanceof Date)) {
            dateObj = new Date(dateObj);
        }
        // Pokud je datum neplatné, použít dnešní datum
        if (isNaN(dateObj.getTime())) {
            dateObj = new Date();
        }
        
        // Lokální ISO datum (konzistentní s párováním noclehu ve vicedenniVypocet;
        // vyhne se UTC posunu u Date s lokálním časem přes půlnoc).
        const dateFormatted = naIsoDatum(dateObj);
        
        // Spočítat hodiny - parsovat časy správně
        const [startHour, startMin] = earliestTime.split(':').map(Number);
        const [endHour, endMin] = latestTime.split(':').map(Number);
        const hoursWorked = (endHour + endMin/60) - (startHour + startMin/60);
        
        const mistoOd = (segOdjezd?.Misto_Odjezdu || '').trim();
        const mistoDo = (segPrijezd?.Misto_Prijezdu || '').trim();
        return {
            Datum: dateFormatted,
            Od: earliestTime,
            Do: latestTime,
            Cas: Math.round(Math.max(0, hoursWorked) * 100) / 100,
            Misto_Od: mistoOd,
            Misto_Do: mistoDo,
            Uzavreny: !!mistoOd && !!mistoDo && mistoOd.toLowerCase() === mistoDo.toLowerCase(),
        };
    }).filter(day => day.Cas > 0);
}

/**
 * Výpočet celkových pracovních hodin pro konkrétního uživatele
 */
export function calculateWorkHours(formData, userIntAdr) {
    const workDays = calculateWorkDays(formData, userIntAdr);
    return workDays.reduce((total, day) => total + day.Cas, 0);
}

/**
 * Najde správný tarif podle odpracovaných hodin - porovnání s HH:mm formátem
 */
export function findTariffByWorkTime(workHours, tariffs) {
    if (!tariffs || tariffs.length === 0) return null;
    
    // Převést hodiny na HH:mm formát pro porovnání s Trvani_Od/Do
    const hours = Math.floor(workHours);
    const minutes = Math.round((workHours - hours) * 60);
    const workTimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    return tariffs.find(tariff => 
        workTimeString >= tariff.Trvani_Od && workTimeString <= tariff.Trvani_Do
    ) || null;
}

/**
 * Najde správný tarif podle odpracovaných hodin - deprecated, použít findTariffByWorkTime
 */
export function findApplicableTariff(workHours, tariffs) {
    return tariffs.find(tariff => 
        workHours >= tariff.dobaOd && workHours < tariff.dobaDo
    ) || null;
}

/**
 * Výpočet dopravních nákladů pro konkrétního uživatele - jen celková částka
 * Auto jízdné: pouze řidiči skupiny
 * Veřejná doprava: všem cestujícím skupiny
 * Respektuje Hlavni_Ridic pro zvýšenou sazbu napříč všemi skupinami
 */
export function calculateTransportCosts(formData, tariffRates, userIntAdr = null) {
    if (!userIntAdr || !formData.Skupiny_Cest) return 0;
    
    let totalCosts = 0;
    
    // Projít všechny skupiny kde uživatel cestuje
    formData.Skupiny_Cest.forEach(group => {
        // Zkontrolovat zda je uživatel cestujícím v této skupině
        const isUserParticipant = group.Cestujci && group.Cestujci.includes(userIntAdr);
        if (!isUserParticipant) return;
        
        // Zkontrolovat zda je uživatel řidičem této skupiny
        const isUserDriverOfGroup = group.Ridic === userIntAdr;
        
        // Zkontrolovat zda je uživatel hlavním řidičem (dostane zvýšenou sazbu na všechny AUV jízdy)
        const isUserMainDriver = formData.Hlavni_Ridic == userIntAdr;
        
        group.Cesty?.forEach(segment => {
            if (!segment || !segment.Druh_Dopravy) return;
            
            if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                // Auto jízdné - pouze řidiči skupiny
                if (isUserDriverOfGroup && segment.Kilometry > 0) {
                    const rate = isUserMainDriver ? tariffRates.jizdneZvysene : tariffRates.jizdne;
                    totalCosts += segment.Kilometry * rate;
                }
            } else if (segment.Druh_Dopravy === "V") {
                // Veřejná doprava - pouze pokud má uživatel zadanou částku
                if (typeof segment.Naklady === 'object' && segment.Naklady !== null) {
                    totalCosts += segment.Naklady[userIntAdr] || 0;
                }
                // Pokud Naklady není objekt, ignorovat (nezadáno)
            }
            // Pěšky ("P") a kolo ("K") = 0 Kč pro všechny
        });
    });
    
    return totalCosts;
}

/**
 * Výpočet detailů jízdného pro konkrétního uživatele
 * Vrací pole objektů s detaily jednotlivých náhrad
 */
export function calculateTransportDetails(formData, tariffRates, userIntAdr = null) {
    if (!userIntAdr || !formData.Skupiny_Cest) return [];
    
    const details = [];
    
    // Projít všechny skupiny kde uživatel cestuje
    formData.Skupiny_Cest.forEach(group => {
        // Zkontrolovat zda je uživatel cestujícím v této skupině
        const isUserParticipant = group.Cestujci && group.Cestujci.includes(userIntAdr);
        if (!isUserParticipant) return;
        
        // Zkontrolovat zda je uživatel řidičem této skupiny
        const isUserDriverOfGroup = group.Ridic === userIntAdr;
        
        // Zkontrolovat zda je uživatel hlavním řidičem (dostane zvýšenou sazbu na všechny AUV jízdy)
        const isUserMainDriver = formData.Hlavni_Ridic == userIntAdr;
        
        group.Cesty?.forEach(segment => {
            if (!segment || !segment.Druh_Dopravy) return;
            
            if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                // Auto jízdné - pouze řidiči skupiny
                if (isUserDriverOfGroup && segment.Kilometry > 0) {
                    const rate = isUserMainDriver ? tariffRates.jizdneZvysene : tariffRates.jizdne;
                    const cost = Math.round(segment.Kilometry * rate * 100) / 100;
                    
                    details.push({
                        Typ_Dopravy: isUserMainDriver ? "AUVV" : "AUVN",
                        Km: String(segment.Kilometry),
                        Kc: String(cost)
                    });
                }
            } else if (segment.Druh_Dopravy === "V") {
                // Veřejná doprava - pouze pokud má uživatel zadanou částku
                if (typeof segment.Naklady === 'object' && segment.Naklady !== null) {
                    const cost = segment.Naklady[userIntAdr] || 0;
                    if (cost > 0) {
                        details.push({
                            Typ_Dopravy: "V",
                            Km: "0",
                            Kc: String(cost)
                        });
                    }
                }
            }
            // Pěšky ("P") a kolo ("K") = 0 Kč pro všechny - nepřidávají se do detailů
        });
    });
    
    return details;
}

/**
 * Výpočet kompenzace pro konkrétního uživatele
 * Vrací data v Czech Snake_Case formátu s detailními dny práce
 * @param {Object} formData - Formulářová data
 * @param {Object} tariffRates - Sazby
 * @param {number} userIntAdr - INT_ADR uživatele
 * @param {Object} usersDetails - Data uživatelů pro kontrolu kvalifikací
 * @returns {Object|null} - Objekt kompenzace nebo null
 */
export function calculateCompensation(formData, tariffRates, userIntAdr = null, usersDetails = null) {
    if (!tariffRates || !userIntAdr) return null;

    // Kontrola kvalifikace - uživatel musí mít kvalifikaci opravňující k náhradám
    const maNarok = maNarokNaNahrady(usersDetails, userIntAdr);

    log.info('calculateCompensation: kontrola nároku na náhrady', {
        userIntAdr,
        maNarok,
        budouNahrady: maNarok ? 'ANO' : 'NE (chybí kvalifikace pro náhrady)'
    });

    // Pracovní dny (obohacené o Uzavreny/místo) a účetní dny (per-den, přechod přes půlnoc dle noclehu)
    const workDays = calculateWorkDays(formData, userIntAdr);
    const ucetniDnyRaw = budujUcetniDny(workDays, formData.Noclezne || []);

    // Stravné a náhrady se počítají VŽDY po dnech a sčítají (potvrzeno KČT).
    // Ke každému účetnímu dni připojíme i jeho částku (Stravne/Nahrada) pro rozpad v souhrnu.
    let mealAllowance = 0;
    let workAllowance = 0;
    const ucetniDny = ucetniDnyRaw.map(den => {
        const st = findTariffByWorkTime(den.Cas, tariffRates.stravneTariffs);
        const stravneDne = st ? parseFloat(st.Stravne || 0) : 0;
        const nt = findTariffByWorkTime(den.Cas, tariffRates.nahradyTariffs);
        // Náhrada za práci — POUZE pokud má kvalifikaci opravňující k náhradám
        const nahradaDne = (maNarok && nt) ? parseFloat(nt.Nahrada || 0) : 0;
        mealAllowance += stravneDne;
        workAllowance += nahradaDne;
        return { ...den, Stravne: stravneDne, Nahrada: nahradaDne };
    });

    // Celková doba práce = součet účetních hodin po dnech (včetně přechodu přes půlnoc)
    const totalWorkHours = ucetniDny.reduce((total, den) => total + den.Cas, 0);

    // Spočítat dopravní náklady pro uživatele
    const transportCosts = calculateTransportCosts(formData, tariffRates, userIntAdr);
    
    // Ubytování - pouze pro toho kdo platil
    const accommodationCosts = (formData.Noclezne || [])
        .filter(acc => acc.Zaplatil === userIntAdr)
        .reduce((sum, acc) => sum + (acc.Castka || 0), 0);
    
    // Vedlejší výdaje - pouze pro toho kdo platil   
    const additionalExpenses = (formData.Vedlejsi_Vydaje || [])
        .filter(exp => exp.Zaplatil === userIntAdr)
        .reduce((sum, exp) => sum + (exp.Castka || 0), 0);
    
    // Zkontrolovat zda má uživatel zvýšenou sazbu v nějaké skupině
    const hasHigherRate = formData.Hlavni_Ridic == userIntAdr;
    
    const total = transportCosts + mealAllowance + workAllowance + accommodationCosts + additionalExpenses;
    
    // Připravit detaily jízdného z existujících dat
    const jizdneDetails = [];
    formData.Skupiny_Cest?.forEach(group => {
        const isUserParticipant = group.Cestujci && group.Cestujci.includes(userIntAdr);
        if (!isUserParticipant) return;
        
        const isUserDriverOfGroup = group.Ridic === userIntAdr;
        
        group.Cesty?.forEach(segment => {
            if (!segment || !segment.Druh_Dopravy) return;
            
            if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                if (isUserDriverOfGroup && segment.Kilometry > 0) {
                    const rate = hasHigherRate ? tariffRates.jizdneZvysene : tariffRates.jizdne;
                    const cost = Math.round(segment.Kilometry * rate * 100) / 100;
                    
                    jizdneDetails.push({
                        id: segment.id,
                        Typ_Dopravy: hasHigherRate ? "AUVV" : "AUVN",
                        Km: segment.Kilometry,
                        Kc: cost
                    });
                }
            } else if (segment.Druh_Dopravy === "V") {
                if (typeof segment.Naklady === 'object' && segment.Naklady !== null) {
                    const cost = segment.Naklady[userIntAdr] || 0;
                    if (cost > 0) {
                        jizdneDetails.push({
                            id: segment.id,
                            Typ_Dopravy: "V",
                            Km: 0,
                            Kc: cost
                        });
                    }
                }
            }
        });
    });
    
    // Připravit detaily vedlejších výdajů z existujících dat
    const vedlejsiVydajeDetails = (formData.Vedlejsi_Vydaje || [])
        .filter(exp => exp.Zaplatil === userIntAdr && exp.Castka > 0)
        .map(exp => ({
            id: exp.id,
            Popis: exp.Polozka || "Neurčeno",
            Kc: exp.Castka || 0
        }));
    
    // Připravit detaily nocležného z existujících dat
    const noclezneDetails = (formData.Noclezne || [])
        .filter(acc => acc.Zaplatil === userIntAdr && acc.Castka > 0)
        .map(acc => ({
            id: acc.id,
            Datum: acc.Datum ? toISODateString(acc.Datum) : "",
            Misto: acc.Misto || "",
            Zarizeni: acc.Zarizeni || "",
            Kc: acc.Castka || 0
        }));

    const result = {
        INT_ADR: userIntAdr,
        Jizdne: jizdneDetails,
        Jizdne_Celkem: Math.round(transportCosts * 100) / 100,
        Zvysena_Sazba: hasHigherRate,
        Stravne: Math.round(mealAllowance * 100) / 100,
        Nahrada_Prace: Math.round(workAllowance * 100) / 100,
        Noclezne: noclezneDetails,
        Noclezne_Celkem: Math.round(accommodationCosts * 100) / 100,
        Vedlejsi_Vydaje: vedlejsiVydajeDetails,
        Vedlejsi_Vydaje_Celkem: Math.round(additionalExpenses * 100) / 100,
        Cas_Prace_Celkem: Math.round(totalWorkHours * 100) / 100,
        // Cas_Prace jde do INSYZ jako ÚČETNÍ okna po dnech (přechod přes půlnoc), protože
        // INSYZ neumí dopočítat půlnoc – posílá se den výjezdu 07:00–23:59 a den návratu
        // 00:00–15:00 (24:00 → 23:59). Štíhlý tvar {Datum, Od, Do, Cas} kvůli stabilitě XML.
        Cas_Prace: ucetniDny.map(d => ({
            Datum: d.Datum,
            Od: d.Od,
            Do: d.Do === '24:00' ? '23:59' : d.Do,
            Cas: d.Cas,
        })),
        // Ucetni_Dny slouží UI (rozpad po dnech); z INSYZ XML se odfiltruje v XmlGenerationService.
        Ucetni_Dny: ucetniDny,
        Celkem_Kc: Math.round(total * 100) / 100
    };
    
    // Calculation completed
    
    return result;
}

/**
 * Extract team members from order head data - stejně jako v původní aplikaci
 */
export function extractTeamMembers(head) {
    if (!head || typeof head !== 'object') return [];
    
    try {
        const members = [1, 2, 3]
            .map(i => ({
                index: i,
                name: head[`Znackar${i}`],
                INT_ADR: head[`INT_ADR_${i}`],
                isLeader: head[`Je_Vedouci${i}`] === "1"
            }))
            .filter(member => member.name?.trim && member.name.trim());
            
        return members;
    } catch (error) {
        return [];
    }
}

/**
 * Výpočet kompenzací pro všechny členy týmu
 * Vrací data indexovaná podle INT_ADR v novém formátu
 */
export function calculateCompensationForAllMembers(formData, tariffRates, teamMembers, usersDetails) {
    if (!tariffRates || !teamMembers) return {};
    
    const result = {};
    
    teamMembers.forEach(member => {
        const compensation = calculateCompensation(formData, tariffRates, member.INT_ADR, usersDetails);
        if (compensation) {
            result[member.INT_ADR] = compensation;
        }
    });
    
    return result;
}

/**
 * Check if user is leader in team
 */
export function isUserLeader(user, head) {
    if (!user || !head) return false;
    
    const isLeader = [1, 2, 3].some(i =>
        parseInt(head[`INT_ADR_${i}`]) === user.INT_ADR && head[`Je_Vedouci${i}`] === "1"
    );
    
    return isLeader;
}

/**
 * Check if user can edit specific expense (based on Zaplatil)
 */
export function canUserEditExpense(user, expense, isLeader) {
    if (isLeader) return true; // Vedoucí může editovat vše
    if (!user) return false;
    
    // Člen může editovat jen svoje výdaje
    return expense.Zaplatil === user.INT_ADR;
}

