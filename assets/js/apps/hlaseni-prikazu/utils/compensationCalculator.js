/**
 * Parse price list from API response - 1:1 s původní aplikací
 */
export function parsePriceListFromAPI(apiData) {
    if (!apiData) return null;
    
    // Vytvoření tarifů z API dat
    const tariffs = [];
    for (let i = 1; i <= 6; i++) {
        const dobaOd = apiData[`tarifDobaOd${i}`];
        const dobaDo = apiData[`tarifDobaDo${i}`];
        const stravne = apiData[`tarifStravne${i}`];
        const nahrada = apiData[`tarifNahrada${i}`];
        
        if (dobaOd !== undefined && dobaDo !== undefined) {
            tariffs.push({
                dobaOd,
                dobaDo,
                stravne: stravne || 0,
                nahrada: nahrada || 0
            });
        }
    }
    
    return {
        jizdne: apiData.jizdne || 6,
        jizdneZvysene: apiData.jizdneZvysene || 8,
        tariffs
    };
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
        
        // Použít segment.Datum pokud existuje, jinak Datum_Provedeni jako fallback
        let segmentDate = segment.Datum || formData.Datum_Provedeni || new Date();
        
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
        
        segments.forEach(s => {
            if (s.Cas_Odjezdu) {
                const startTime = s.Cas_Odjezdu;
                if (!earliestTime || startTime < earliestTime) {
                    earliestTime = startTime;
                }
            }
            if (s.Cas_Prijezdu) {
                const endTime = s.Cas_Prijezdu;
                if (!latestTime || endTime > latestTime) {
                    latestTime = endTime;
                }
            }
        });
        
        // Vytvořit ISO datetime string s lokálním časem (bez UTC konverze)
        const dateFormatted = date.toISOString().split('T')[0]; // yyyy-mm-dd
        const startDateTime = `${dateFormatted}T${earliestTime}:00`; // přidat sekundy
        const endDateTime = `${dateFormatted}T${latestTime}:00`;
        
        // Spočítat hodiny - parsovat časy správně
        const [startHour, startMin] = earliestTime.split(':').map(Number);
        const [endHour, endMin] = latestTime.split(':').map(Number);
        const hoursWorked = (endHour + endMin/60) - (startHour + startMin/60);
        
        return {
            Od: startDateTime,
            Do: endDateTime,
            Hodin: Math.max(0, hoursWorked)
        };
    }).filter(day => day.Hodin > 0);
}

/**
 * Výpočet celkových pracovních hodin pro konkrétního uživatele
 */
export function calculateWorkHours(formData, userIntAdr) {
    const workDays = calculateWorkDays(formData, userIntAdr);
    return workDays.reduce((total, day) => total + day.Hodin, 0);
}

/**
 * Najde správný tarif podle odpracovaných hodin
 */
export function findApplicableTariff(workHours, tariffs) {
    return tariffs.find(tariff => 
        workHours >= tariff.dobaOd && workHours < tariff.dobaDo
    ) || null;
}

/**
 * Výpočet dopravních nákladů pro konkrétního uživatele
 * Auto jízdné: pouze řidiči skupiny
 * Veřejná doprava: všem cestujícím skupiny
 * Respektuje Ma_Zvysenou_Sazbu per skupina
 */
export function calculateTransportCosts(formData, priceList, userIntAdr = null) {
    if (!userIntAdr || !formData.Skupiny_Cest) return 0;
    
    let totalCosts = 0;
    
    // Projít všechny skupiny kde uživatel cestuje
    formData.Skupiny_Cest.forEach(group => {
        // Zkontrolovat zda je uživatel cestujícím v této skupině
        const isUserParticipant = group.Cestujci && group.Cestujci.includes(userIntAdr);
        if (!isUserParticipant) return;
        
        // Zkontrolovat zda je uživatel řidičem této skupiny
        const isUserDriverOfGroup = group.Ridic === userIntAdr;
        
        // Zkontrolovat zda má skupina zvýšenou sazbu
        const hasGroupHigherRate = group.Ma_Zvysenou_Sazbu || false;
        
        group.Cesty?.forEach(segment => {
            if (!segment || !segment.Druh_Dopravy) return;
            
            if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                // Auto jízdné - pouze řidiči skupiny
                if (isUserDriverOfGroup) {
                    const rate = hasGroupHigherRate ? priceList.jizdneZvysene : priceList.jizdne;
                    totalCosts += (segment.Kilometry || 0) * rate;
                }
            } else if (segment.Druh_Dopravy === "V") {
                // Veřejná doprava - všem cestujícím skupiny
                totalCosts += segment.Naklady || 0;
            }
            // Pěšky ("P") a kolo ("K") = 0 Kč pro všechny
        });
    });
    
    return totalCosts;
}

/**
 * Výpočet kompenzace pro konkrétního uživatele
 * Vrací data v Czech Snake_Case formátu s detailními dny práce
 */
export function calculateCompensation(formData, priceList, userIntAdr = null) {
    if (!priceList || !priceList.tariffs || !userIntAdr) return null;
    
    // Spočítat pracovní dny a celkové hodiny pro uživatele
    const workDays = calculateWorkDays(formData, userIntAdr);
    const totalWorkHours = workDays.reduce((total, day) => total + day.Hodin, 0);
    
    // Najít příslušný tarif
    const appliedTariff = findApplicableTariff(totalWorkHours, priceList.tariffs);
    
    // Spočítat dopravní náklady pro uživatele
    const transportCosts = calculateTransportCosts(formData, priceList, userIntAdr);
    
    // Stravné a náhrada za práci podle tarifu
    const mealAllowance = appliedTariff?.stravne || 0;
    const workAllowance = appliedTariff?.nahrada || 0;
    
    // Ubytování - pouze pro toho kdo platil
    const accommodationCosts = (formData.Noclezne || [])
        .filter(acc => acc.Zaplatil === userIntAdr)
        .reduce((sum, acc) => sum + (acc.Castka || 0), 0);
    
    // Vedlejší výdaje - pouze pro toho kdo platil   
    const additionalExpenses = (formData.Vedlejsi_Vydaje || [])
        .filter(exp => exp.Zaplatil === userIntAdr)
        .reduce((sum, exp) => sum + (exp.Castka || 0), 0);
    
    // Zkontrolovat zda má uživatel zvýšenou sazbu v nějaké skupině
    const hasHigherRate = formData.Skupiny_Cest?.some(group => 
        group.Cestujci?.includes(userIntAdr) && 
        group.Ridic === userIntAdr && 
        group.Ma_Zvysenou_Sazbu
    ) || false;
    
    const total = transportCosts + mealAllowance + workAllowance + accommodationCosts + additionalExpenses;
    
    return {
        INT_ADR: userIntAdr,
        Jizdne: transportCosts,
        Zvysena_Sazba: hasHigherRate,
        Stravne: mealAllowance,
        Nahrada_Prace: workAllowance,
        Naklady_Ubytovani: accommodationCosts,
        Vedlejsi_Vydaje: additionalExpenses,
        Hodin_Celkem: totalWorkHours,
        Dny_Prace: workDays,
        celkem: total, // Zachováno pro backwards compatibility s UI
        // Dodatečné info pro UI
        appliedTariff: appliedTariff
    };
}

/**
 * Extract team members from order head data - stejně jako v původní aplikaci
 */
export function extractTeamMembers(head) {
    if (!head || typeof head !== 'object') return [];
    
    try {
        return [1, 2, 3]
            .map(i => ({
                index: i,
                name: head[`Znackar${i}`],
                INT_ADR: head[`INT_ADR_${i}`],
                isLeader: head[`Je_Vedouci${i}`] === "1"
            }))
            .filter(member => member.name?.trim && member.name.trim());
    } catch (error) {
        console.error('Error in extractTeamMembers:', error);
        return [];
    }
}

/**
 * Výpočet kompenzací pro všechny členy týmu
 * Vrací data indexovaná podle INT_ADR v novém formátu
 */
export function calculateCompensationForAllMembers(formData, priceList, teamMembers) {
    if (!priceList || !teamMembers) return {};
    
    const result = {};
    
    teamMembers.forEach(member => {
        const compensation = calculateCompensation(formData, priceList, member.INT_ADR);
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
    
    return [1, 2, 3].some(i =>
        head[`INT_ADR_${i}`] === user.INT_ADR && head[`Je_Vedouci${i}`] === "1"
    );
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

