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
 * Výpočet celkových pracovních hodin - 1:1 s původní aplikací
 * Od nejdřívějšího začátku do nejpozdějšího konce cesty v každém dni
 */
export function calculateWorkHours(formData) {
    // Extraktovat všechny segmenty ze všech travel groups
    const allSegments = formData.travelGroups?.flatMap(group => 
        group.segments || []
    ) || [];
    
    if (allSegments.length === 0) return 0;

    // Seskupit segmenty podle dne - přesně jako v původní aplikaci
    const segmentsByDate = allSegments.reduce((acc, segment) => {
        if (!segment) return acc;
        
        // Použít segment.date pokud existuje, jinak executionDate jako fallback
        const segmentDate = segment.date || formData.executionDate || new Date();
        const dateKey = segmentDate.toDateString();
        
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(segment);
        return acc;
    }, {});
    
    // Spočítat hodiny pro každý den
    return Object.entries(segmentsByDate).reduce((totalHours, [dateStr, segments]) => {
        const validSegments = segments.filter(s => s.startTime && s.endTime);
        if (validSegments.length === 0) return totalHours;
        
        // Najít nejdřívější čas začátku a nejpozdější čas konce
        const startTimes = validSegments.map(s => new Date(`${dateStr} ${s.startTime}`));
        const endTimes = validSegments.map(s => new Date(`${dateStr} ${s.endTime}`));
        
        const earliestStart = new Date(Math.min(...startTimes.map(d => d.getTime())));
        const latestEnd = new Date(Math.max(...endTimes.map(d => d.getTime())));
        
        if (latestEnd > earliestStart) {
            totalHours += (latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60);
        }
        
        return totalHours;
    }, 0);
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
 * Výpočet dopravních nákladů (pouze pro řidiče u aut) - přesně podle původní aplikace
 */
export function calculateTransportCosts(formData, priceList, isDriver = true, hasHigherRate = false) {
    if (!isDriver) return 0; // Jízdné se počítá pouze řidiči
    
    let totalCosts = 0;
    
    // Extraktovat všechny segmenty ze všech travel groups
    const allSegments = formData.travelGroups?.flatMap(group => 
        group.segments || []
    ) || [];
    
    allSegments.forEach(segment => {
        if (!segment || !segment.transportType) return;
        
        if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
            const rate = hasHigherRate ? priceList.jizdneZvysene : priceList.jizdne;
            totalCosts += (segment.kilometers || 0) * rate;
        } else if (segment.transportType === "veřejná doprava") {
            totalCosts += segment.ticketCosts || 0;
        }
        // Pěšky a kolo = 0 Kč
    });
    
    return totalCosts;
}

/**
 * Calculate total compensation based on form data and price list - 1:1 s původní aplikací
 */
export function calculateCompensation(formData, priceList, isDriver = true, hasHigherRate = false, userIntAdr = null) {
    if (!priceList || !priceList.tariffs) return null;
    
    const workHours = calculateWorkHours(formData);
    const appliedTariff = findApplicableTariff(workHours, priceList.tariffs);
    
    const transportCosts = calculateTransportCosts(formData, priceList, isDriver, hasHigherRate);
    const mealAllowance = appliedTariff?.stravne || 0;
    const workAllowance = appliedTariff?.nahrada || 0;
    
    // Accommodation - pouze pro toho kdo platil (přesně jako v původní aplikaci)
    const accommodationCosts = formData.accommodations
        .filter(acc => !userIntAdr || acc.paidByMember === userIntAdr)
        .reduce((sum, acc) => sum + (acc.amount || 0), 0);
    
    // Additional expenses - pouze pro toho kdo platil (přesně jako v původní aplikaci)   
    const additionalExpenses = formData.additionalExpenses
        .filter(exp => !userIntAdr || exp.paidByMember === userIntAdr)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    const total = transportCosts + mealAllowance + workAllowance + accommodationCosts + additionalExpenses;
    
    return {
        transportCosts,
        mealAllowance, 
        workAllowance,
        accommodationCosts,
        additionalExpenses,
        total,
        workHours,
        appliedTariff,
        isDriver
    };
}

/**
 * Extract team members from order head data - stejně jako v původní aplikaci
 */
export function extractTeamMembers(head) {
    if (!head) return [];
    
    return [1, 2, 3]
        .map(i => ({
            index: i,
            name: head[`Znackar${i}`],
            int_adr: head[`INT_ADR_${i}`],
            isLeader: head[`Je_Vedouci${i}`] === "1"
        }))
        .filter(member => member.name?.trim());
}

/**
 * Calculate compensations for all team members - 1:1 s původní aplikací
 */
export function calculateCompensationForAllMembers(formData, priceList, teamMembers, primaryDriverIntAdr, hasHigherRate) {
    if (!priceList || !teamMembers) return {};
    
    const result = {};
    
    teamMembers.forEach(member => {
        const isDriver = member.int_adr === primaryDriverIntAdr;
        result[member.int_adr] = calculateCompensation(
            formData,
            priceList,
            isDriver,
            hasHigherRate,
            member.int_adr
        );
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
 * Check if user can edit specific expense (based on paidByMember)
 */
export function canUserEditExpense(user, expense, isLeader) {
    if (isLeader) return true; // Vedoucí může editovat vše
    if (!user) return false;
    
    // Člen může editovat jen svoje výdaje
    return expense.paidByMember === user.INT_ADR;
}

