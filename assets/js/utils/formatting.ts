export function formatKm(km?: string | number | null): string {
	if (!km || isNaN(Number(km))) return "";
	return parseFloat(km.toString()).toLocaleString("cs-CZ", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 3,
	});
}

export function formatCurrency(amount: number): string {
	return amount.toLocaleString("cs-CZ", {
		style: "currency",
		currency: "CZK",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
}

export function formatTime(time: string): string {
	if (!time) return "";
	// Pokud je čas ve formátu HH:MM, vrátíme jak je
	if (/^\d{1,2}:\d{2}$/.test(time)) return time;
	// Pokud je ve formátu H:MM, přidáme nulu
	if (/^\d:\d{2}$/.test(time)) return `0${time}`;
	return time;
}

export function getHeadingsFromHtml(html: string) {
	const container = document.createElement('div');
	container.innerHTML = html;
	const headings = [...container.querySelectorAll('h2, h3')].map(el => ({
		id: el.id,
		level: Number(el.tagName[1]),
		text: el.textContent || '',
	}));
	return headings;
}

/**
 * Přidá automaticky id do H2-H6, pokud ho nemají.
 * Zachovává původní id, pokud existuje.
 */
export function addHeadingIdsToHtml(html: string): string {
	// Pomocná funkce na vytvoření slug/id z textu nadpisu
	function slugify(str: string): string {
		return str
			.toLowerCase()
			.normalize('NFD') // diakritika pryč
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-') // vše ostatní na pomlčku
			.replace(/^-+|-+$/g, '') // trim začátek/konec
			.replace(/-{2,}/g, '-'); // více pomlček na jednu
	}

	// Regular Expression pro <h2> až <h6>
	return html.replace(
		/<h([2-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
		(match, level, attrs, text) => {
			// Pokud už id existuje, necháme jak je
			if (/id=("|')[^"']+("|')/i.test(attrs)) return match;
			// Vyextrahujeme plain text (i kdyby byl uvnitř <span> apod.)
			const tmp = document.createElement('div');
			tmp.innerHTML = text;
			const headingText = tmp.textContent || tmp.innerText || '';
			const id = slugify(headingText);
			// Přidáme id do atributů
			return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
		}
	);
}

/**
 * Převede kód typu úseku na čitelný název
 * @param code - Kód typu úseku ("U", "O" nebo jiný)
 * @returns Textové označení typu úseku
 */
export function formatUsekType(code?: string | null): string {
	if (!code) return "";
	
	switch (code.toUpperCase()) {
		case "U":
			return "Úsek";
		case "O":
			return "Odbočka";
		default:
			return code;
	}
}

/**
 * Převede kód stavu TIM na čitelný název
 * @param code - Kód stavu TIM ("R", "P" nebo jiný)
 * @returns Textové označení stavu TIM
 */
export function formatTimStatus(code?: string | null): string {
	if (!code) return "";
	
	switch (code.toUpperCase()) {
		case "R":
			return "Realizováno";
		case "P":
			return "Příprava";
		default:
			return code;
	}
}