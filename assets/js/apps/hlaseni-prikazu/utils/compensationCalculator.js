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
 */
export function calculateWorkHours(formData) {
    if (!formData.travelSegments || formData.travelSegments.length === 0) return 0;

    let earliestStart = null;
    let latestEnd = null;

    formData.travelSegments.forEach(segment => {
        if (segment.startTime && segment.endTime) {
            const startTime = new Date(`1970-01-01T${segment.startTime}:00`);
            const endTime = new Date(`1970-01-01T${segment.endTime}:00`);

            if (!earliestStart || startTime < earliestStart) {
                earliestStart = startTime;
            }
            if (!latestEnd || endTime > latestEnd) {
                latestEnd = endTime;
            }
        }
    });

    if (earliestStart && latestEnd) {
        const diffMs = latestEnd - earliestStart;
        return diffMs / (1000 * 60 * 60); // Convert to hours
    }

    return 0;
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
 * Výpočet dopravních nákladů (pouze pro řidiče u aut)
 */
export function calculateTransportCosts(formData, priceList, isDriver = true) {
    if (!isDriver) return 0; // Jízdné se počítá pouze řidiči
    
    let totalCosts = 0;
    
    formData.travelSegments.forEach(segment => {
        if (!segment || !segment.transportType) return;
        
        if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
            const rate = formData.higherKmRate ? priceList.jizdneZvysene : priceList.jizdne;
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
    
    const transport = calculateTransportCosts(formData, priceList, isDriver);
    const meals = appliedTariff?.stravne || 0;
    const work = appliedTariff?.nahrada || 0;
    
    // Accommodation - pouze pro toho kdo platil
    const accommodation = formData.accommodations
        .filter(acc => !userIntAdr || acc.paidByMember === userIntAdr)
        .reduce((sum, acc) => sum + (acc.amount || 0), 0);
    
    // Additional expenses - pouze pro toho kdo platil    
    const additional = formData.additionalExpenses
        .filter(exp => !userIntAdr || exp.paidByMember === userIntAdr)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    const total = transport + meals + work + accommodation + additional;
    
    return {
        transport,
        meals,
        work,
        accommodation,
        additional,
        total,
        workHours,
        appliedTariff
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
    
    const compensations = {};
    
    teamMembers.forEach(member => {
        const isDriver = primaryDriverIntAdr === member.int_adr;
        const memberCompensation = calculateCompensation(
            formData, 
            priceList, 
            isDriver, 
            hasHigherRate, 
            member.int_adr
        );
        
        if (memberCompensation) {
            compensations[member.int_adr] = {
                ...memberCompensation,
                memberName: member.name,
                isDriver,
                isLeader: member.isLeader
            };
        }
    });
    
    return compensations;
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

