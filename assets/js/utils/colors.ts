export function barvaDlePresunu(val: string | undefined) {
	if (!val) return "";
	const v = val.trim().toUpperCase();
	switch (v) {
		case "PZT":
			return "#ffffff";  // bílá (RAL 1013 - perlová bílá)
		case "LZT":
			return "#f7951d";  // oranžová (RAL 2009 - dopravní oranžová)
		case "CZT":
		case "CZS":
			return "#ffe000";  // žlutá (RAL 1003 - signální žlutá)
		default:
			return "#ffffff";     // fallback (bílá)
	}
}

// staré - poučijte barvaDleKodu
export function barvaDleJmena(val: string | undefined) {
	if (!val) return "";
	const v = val.trim().toLowerCase();
	switch (v) {
		case "červená":
			return "#e50313";   // RAL 3020 (červená signální) – přibližně #cc1122
		case "modrá":
			return "#1a6dff";   // RAL 5015 (modrá nebeská) – přibližně #2277bb
		case "zelená":
			return "#009C00";   // RAL 6024 (zelená dopravní) – přibližně #01876e
		case "žlutá":
			return "#ffdd00";   // RAL 1003 (žlutá signální)
		case "bílá":
			return "#f8f9fa";   // RAL 1013 (bílá perlová)
		case "oranžová":
			return "#f7951d";   // RAL 2009 (oranžová dopravní)
		case "khaki":
			return "#6A5F31";   // RAL 7008 (Khaki Gray)
		case "hnědá":
			return "#59351F";   // RAL 8007 (hnědá)
		default:
			return "#cccccc";   // fallback šedá
	}
}
export function barvaDleKodu(val: string | undefined) {
	if (!val) return "";
	const v = val.trim().toUpperCase();
	switch (v) {
		case "CE":
			return "#e50313";   // RAL 3020 (červená signální) – přibližně #cc1122
		case "MO":
			return "#1a6dff";   // RAL 5015 (modrá nebeská) – přibližně #2277bb
		case "ZE":
			return "#009C00";   // RAL 6024 (zelená dopravní) – přibližně #01876e
		case "ZL":
			return "#ffdd00";   // RAL 1003 (žlutá signální)
		case "BI":
			return "#ffffff";   // RAL 1013 (bílá perlová)
		case "KH":
			return "#6A5F31";   // RAL 7008 (Khaki Gray)
		case "BE":
			return "transparent";   // bezbarvá
		case "XX":
			return "transparent";   // nerozlišeno
		case "CA":
			return "#000000";   // černá
		default:
			return "#cccccc";   // fallback šedá
	}
}

export function barvaMantine(val: string) {
	if (!val) return "gray";
	const v = val.trim().toLowerCase();
	switch (v) {
		case "červená":
			return "red";
		case "modrá":
			return "blue";
		case "zelená":
			return "green";
		case "žlutá":
			return "yellow.4";
		case "bílá":
			return "orange.0";
		case "oranžová":
			return "orange";
		default:
			return "gray";
	}
}