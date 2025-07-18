import {DateValue} from "@mantine/dates";

export interface FileAttachment {
	id: string;
	fileName: string;
	fileSize: number;
	fileType: string;
	uploadedAt: Date;
	uploadedBy: string;
	url?: string;
	thumbnailUrl?: string;
	rotation?: number;
}

export interface TravelSegment {
	id: string;
	// Základní informace o segmentu
	date: Date;
	startTime: string;
	endTime: string;
	startPlace: string;
	endPlace: string;
	transportType: "AUV" | "AUV-Z" | "veřejná doprava" | "pěšky" | "kolo";
	kilometers: number;
	ticketCosts: number;
	attachments: FileAttachment[];
	vehicleRegistration?: string; // Pro druhého řidiče
	memberIndex?: number; // Pro kterého člena skupiny
}

export interface Accommodation {
	id: string;
	place: string;
	facility: string;
	date: Date;
	amount: number;
	paidByMember: string; // int_adr uživatele, který uhradil
	attachments: FileAttachment[];
}

export interface AdditionalExpense {
	id: string;
	description: string;
	date: Date;
	amount: number;
	paidByMember: string; // int_adr uživatele, který uhradil
	attachments: FileAttachment[];
}

export interface TimItemStatus {
	itemId: string; // Primární identifikátor - ID_PREDMETY z DB
	legacyItemId?: string; // Záložní identifikátor - EvCi_TIM + Predmet_Index pro kompatibilitu
	evCiTim?: string; // Evidenční číslo TIM pro reference
	predmetIndex?: string; // Index předmětu pro reference
	status: 1 | 2 | 3 | 4; // 1-Nová, 2-Zachovalá, 3-Nevyhovující, 4-Zcela chybí
	yearOfProduction?: DateValue;
	arrowOrientation?: "L" | "P"; // Pro směrovky
	comment?: string;
}

export interface TimReport {
	timId: string; // EvCi_TIM
	structuralComment: string; // Komentář k nosnému prvku
	structuralAttachments: FileAttachment[];
	centerRuleCompliant?: boolean; // Splňuje středové pravidlo
	centerRuleComment?: string;
	itemStatuses: TimItemStatus[]; // Stavy jednotlivých tabulek/směrovek
	generalComment?: string;
	photos: FileAttachment[];
}

export interface RouteSegmentReport {
	segmentId: string;
	comment: string;
	attachments: FileAttachment[];
	mapCompliant?: boolean; // Souhlasí s mapou
	mapComment?: string;
	mapAttachments: FileAttachment[];
}

export interface HlaseniFormData {
	// Část A - Provedení
	executionDate: Date;
	travelSegments: TravelSegment[];
	primaryDriver: string; // Jméno hlavního řidiče
	vehicleRegistration: string; // RZ hlavního vozidla
	higherKmRate: boolean; // Vyšší sazba kilometrovného
	accommodations: Accommodation[];
	additionalExpenses: AdditionalExpense[];
	partACompleted: boolean;

	// Část B - Stav TIM (pouze pro ZPO)
	timReports: Record<string, TimReport>; // Key = EvCi_TIM
	routeComment: string;
	routeAttachments?: FileAttachment[];
	partBCompleted: boolean;

	// Přesměrování výplat
	paymentRedirects: Record<number, number>; // Key = int_adr uživatele který posílá, Value = int_adr uživatele který dostává

	// Metadata
	createdAt?: Date;
	updatedAt?: Date;
	submittedAt?: Date;
	status?: "draft" | "submitted" | "approved" | "rejected";
}

export interface PriceListItem {
	type: string;
	description: string;
	price: number;
	unit: string;
	validFrom: Date;
	validTo?: Date;
}

export interface TariffBand {
	dobaOd: number; // hodiny od (včetně)
	dobaDo: number; // hodiny do (méně než)
	stravne: number; // náhrada za stravné
	nahrada: number; // další náhrada
}

export interface PriceList {
	jizdne: number; // základní jízdné za km pro AUV/AUV-Z
	jizdneZvysene: number; // zvýšené jízdné za km
	tariffs: TariffBand[]; // tarify podle odpracovaných hodin
	transport?: PriceListItem[]; // legacy - zachování kompatibility
	work?: PriceListItem[]; // legacy - zachování kompatibility
	other?: PriceListItem[]; // legacy - zachování kompatibility
}

export interface CompensationCalculation {
	transportCosts: number; // jízdné
	mealAllowance: number; // stravné
	workAllowance: number; // náhrada za práci
	accommodationCosts: number; // ubytování
	additionalExpenses: number; // vedlejší výdaje
	total: number;
	workHours: number; // celkové hodiny práce
	appliedTariff?: TariffBand; // použitý tarif
	isDriver: boolean; // je řidič (dostává jízdné)
}