import { HlaseniFormData, PriceList, CompensationCalculation, TariffBand } from "../types/HlaseniTypes";

/**
 * Výpočet celkových pracovních hodin z travel segmentů
 * Od nejdřívějšího začátku do nejpozdějšího konce cesty v každém dni
 */
export function calculateWorkHours(formData: HlaseniFormData): number {
	// Seskupit segmenty podle dne
	const segmentsByDate = formData.travelSegments.reduce((acc, segment) => {
		if (!segment || !segment.date) return acc;
		
		const dateKey = segment.date.toDateString();
		if (!acc[dateKey]) {
			acc[dateKey] = [];
		}
		acc[dateKey].push(segment);
		return acc;
	}, {} as Record<string, typeof formData.travelSegments>);
	
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
export function findApplicableTariff(workHours: number, tariffs: TariffBand[]): TariffBand | null {
	return tariffs.find(tariff => 
		workHours >= tariff.dobaOd && workHours < tariff.dobaDo
	) || null;
}

/**
 * Výpočet dopravních nákladů (jízdné)
 * Pouze pro řidiče u automobilové dopravy
 */
export function calculateTransportCosts(
	formData: HlaseniFormData, 
	priceList: PriceList, 
	isDriver: boolean,
	hasHigherRate: boolean = false
): number {
	if (!isDriver) return 0; // Jízdné se počítá pouze řidiči
	
	let totalCosts = 0;
	
	formData.travelSegments.forEach(segment => {
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
 * Výpočet nákladů na ubytování pro konkrétního uživatele
 */
export function calculateAccommodationCosts(formData: HlaseniFormData, userIntAdr?: string): number {
	if (!userIntAdr) {
		// Pro celkový součet
		return formData.accommodations.reduce((sum, acc) => sum + (acc.amount || 0), 0);
	}
	// Pro konkrétního uživatele - pouze to co uhradil
	return formData.accommodations
		.filter(acc => acc.paidByMember === userIntAdr)
		.reduce((sum, acc) => sum + (acc.amount || 0), 0);
}

/**
 * Výpočet vedlejších výdajů pro konkrétního uživatele
 */
export function calculateAdditionalExpenses(formData: HlaseniFormData, userIntAdr?: string): number {
	if (!userIntAdr) {
		// Pro celkový součet
		return formData.additionalExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
	}
	// Pro konkrétního uživatele - pouze to co uhradil
	return formData.additionalExpenses
		.filter(exp => exp.paidByMember === userIntAdr)
		.reduce((sum, exp) => sum + (exp.amount || 0), 0);
}

/**
 * Převod API dat na PriceList strukturu
 */
export function parsePriceListFromAPI(apiData: any): PriceList {
	// Pokud už máme nový formát, použij ho
	if (apiData.jizdne !== undefined && apiData.tariffs) {
		return apiData as PriceList;
	}
	
	// Konverze ze starého API formátu
	const tariffs: TariffBand[] = [];
	
	// Vytvoření tarifů z API dat
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
		tariffs,
		// Zachování legacy kompatibility
		transport: apiData.transport,
		work: apiData.work,
		other: apiData.other
	};
}

/**
 * Hlavní funkce pro výpočet kompenzací pro konkrétního uživatele
 */
export function calculateCompensation(
	formData: HlaseniFormData, 
	priceList: PriceList, 
	isDriver: boolean,
	hasHigherRate: boolean = false,
	userIntAdr?: string
): CompensationCalculation {
	const workHours = calculateWorkHours(formData);
	const appliedTariff = findApplicableTariff(workHours, priceList.tariffs);
	
	const transportCosts = calculateTransportCosts(formData, priceList, isDriver, hasHigherRate);
	const mealAllowance = appliedTariff?.stravne || 0;
	const workAllowance = appliedTariff?.nahrada || 0;
	const accommodationCosts = calculateAccommodationCosts(formData, userIntAdr);
	const additionalExpenses = calculateAdditionalExpenses(formData, userIntAdr);
	
	const total = transportCosts + mealAllowance + workAllowance + accommodationCosts + additionalExpenses;
	
	return {
		transportCosts,
		mealAllowance,
		workAllowance,
		accommodationCosts,
		additionalExpenses,
		total,
		workHours,
		appliedTariff: appliedTariff || undefined,
		isDriver
	};
}

/**
 * Výpočet kompenzací pro všechny členy skupiny
 */
export function calculateCompensationForAllMembers(
	formData: HlaseniFormData,
	priceList: PriceList,
	teamMembers: Array<{int_adr: string, name: string, isLeader: boolean}>,
	primaryDriverIntAdr: string,
	hasHigherRate: boolean = false
): Record<string, CompensationCalculation> {
	const result: Record<string, CompensationCalculation> = {};
	
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