<?php

namespace App\Service;

use Twig\Environment;

/**
 * Služba pro renderování značek
 * Vrací hotový HTML/SVG string pro vložení do dat
 */
class ZnackaService {
	public function __construct(
		private Environment $twig,
		private ColorService $colorService
	) {
	}

	/**
	 * Vygeneruje SVG značky podle parametrů
	 *
	 * @param string $barvaKod   Kód barvy:
	 *                           CE = červená,
	 *                           MO = modrá,
	 *                           ZE = zelená,
	 *                           ZL = žlutá,
	 *                           BI = bílá,
	 *                           KH = Khaki,
	 *                           BE = bezbarvá,
	 *                           XX = nerozlišeno,
	 *                           CA = černá
	 *
	 * @param string $tvar       kód typu značky nebo tvaru:
	 *                           PA = pásové,
	 *                           MI = místní,
	 *                           NS = NS zvlášť,
	 *                           SN = NS souběžná,
	 *                           VO = vozíčkářská,
	 *                           DO = CTZ silniční,
	 *                           CT = CTZ terénní,
	 *                           NE = bezbarvá,
	 *                           VY = významové – nahrazeno konkrétním tvarem:
	 *                           P = pomník,
	 *                           S = pramen,
	 *                           V = vyhlídka,
	 *                           Z = zřícenina
	 *
	 * @param string $presun     kód přesunu:
	 *                           PZT = pěší,
	 *                           LZT = lyčařská,
	 *                           CZS = cyklo silniční,
	 *                           CZT = cyklo terénní,
	 *                           JZT = jezdecká,
	 *                           VZT = vozíčkářská,
	 *                           0/null = spojka tras
	 *
	 * @param int    $size       rozměr v px
	 */
	public function renderZnacka(
		?string $barvaKod = '',
		?string $tvar = 'PA',
		?string $presun = 'PZT',
		int $size = 24,
		bool $forPdf = false
	): string {
		// Ošetření null hodnot
		$barvaKod = $barvaKod ?? '';
		$tvar = $tvar ?? 'PA';
		$presun = $presun ?? 'PZT';

		// NS je vždy zelená (přesun může být cyklo i pěší).
		if ( $tvar === "NS" || $tvar === "SN" ) {
			$barvaKod = "ZE";
		}

		$upozornovaci = $this->colorService->barvaDlePresunu( $presun );

		if ( empty( $barvaKod ) ) {
			return $this->renderPrazdnaZnacka( $upozornovaci, $size, $forPdf );
		}

		$vedouci    = $this->colorService->barvaDleKodu( $barvaKod );
		$nazevBarvy = $this->colorService->nazevBarvy( $barvaKod );

		// Jezdecká (JZT) má vždy stejný tvar bez ohledu na shape - kruh v bílém čtverci.
		if ( "JZT" === strtoupper( $presun ) ) {
			return $this->renderJezdeckaZnacka( $vedouci, $nazevBarvy, $size, $forPdf );
		}

		switch ( strtoupper( $tvar ) ) {
			case "PA":
			case "CT":
			case "DO":
				return $this->renderPasovaZnacka( $upozornovaci, $vedouci, $nazevBarvy, $size, $forPdf );

			case "Z":
				return $this->renderZriceninaZnacka( $upozornovaci, $vedouci, $nazevBarvy, $size, $forPdf );

			case "S":
				return $this->renderStudankaZnacka( $upozornovaci, $vedouci, $nazevBarvy, $size, $forPdf );

			case "V":
				return $this->renderVrcholZnacka( $upozornovaci, $vedouci, $nazevBarvy, $size, $forPdf );

			case "P":
				return $this->renderPomnikZnacka( $upozornovaci, $vedouci, $nazevBarvy, $size, $forPdf );

			case "MI":
				return $this->renderMistniZnacka( $upozornovaci, $vedouci, $nazevBarvy, $size, $forPdf );

			case "NS":
			case "SN":
				return $this->renderNaucnaZnacka( $upozornovaci, $vedouci, $size, $forPdf );

			case "VO":
				return $this->renderVozickarskaZnacka( $vedouci, $nazevBarvy, $size, $forPdf );

			default:
				return $this->renderPrazdnaZnacka( $upozornovaci, $size, $forPdf );
		}
	}

	/**
	 * Převede SVG na base64 data URI pro PDF kompatibilitu
	 */
	private function wrapSvgForPdf( string $svg, int $size ): string {
		$base64 = base64_encode($svg);
		return '<img src="data:image/svg+xml;base64,' . $base64 . '" width="' . $size . '" height="' . $size . '" />';
	}

	/**
	 * Pásová značka
	 */
	private function renderPasovaZnacka( string $upozornovaci, string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' pásová značka">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<rect x="10" y="10" width="100" height="30" fill="' . $upozornovaci . '"/>
					<rect x="10" y="45" width="100" height="30" fill="' . $vedouci . '"/>
					<rect x="10" y="80" width="100" height="30" fill="' . $upozornovaci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' pásová značka">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<rect x="10" y="10" width="100" height="30" fill="' . $upozornovaci . '"/>
					<rect x="10" y="45" width="100" height="30" fill="' . $vedouci . '"/>
					<rect x="10" y="80" width="100" height="30" fill="' . $upozornovaci . '"/>
				</svg>';
	}

	/**
	 * Zřícenina
	 */
	private function renderZriceninaZnacka( string $upozornovaci, string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' odbočka ke zřícenině">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<path d="M60,60l0,-30l-30,0l0,60l60,0l0,-30l-30,0Z" fill="' . $vedouci . '"/>
					<path d="M110,10l-100,0l0,100l100,0l0,-100Zm-45,15l-40,0l0,70l70,0l0,-40l-30,0l0,-30Z" fill="' . $upozornovaci . '" fill-rule="evenodd"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' odbočka ke zřícenině">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Studánka/pramen
	 */
	private function renderStudankaZnacka( string $upozornovaci, string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' odbočka k prameni">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<path d="M90,60c0,16.57 -13.43,30 -30,30c-16.57,0 -30,-13.43 -30,-30l60,0Z" fill="' . $vedouci . '"/>
					<path d="M110,10l-100,0l0,100l100,0l0,-100Zm-15,45l0,5c0,19.33 -15.67,35 -35,35c-19.33,0 -35,-15.67 -35,-35l0,-5l70,0Z" fill="' . $upozornovaci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' odbočka k prameni">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Vrchol/vyhlídka
	 */
	private function renderVrcholZnacka( string $upozornovaci, string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' odbočka k vyhlídce/vrcholu">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<polygon points="60,36 90,91 30,91" fill="' . $vedouci . '"/>
					<path d="M110,10l-100,0l0,100l100,0l0,-100Zm-50,15l-38,71l76,0Z" fill="' . $upozornovaci . '" fill-rule="evenodd"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' odbočka k vyhlídce/vrcholu">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Pomník
	 */
	private function renderPomnikZnacka( string $upozornovaci, string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' odbočka k jinému zajímavému místu">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<path d="M75,60l0,-30l-30,0l0,30l-35,0l0,30l100,0l0,-30l-35,0Z" fill="' . $vedouci . '"/>
					<path d="M110,55l0,-45l-100,0l0,45l30,0l0,-30l40,0l0,30l30,0Z" fill="' . $upozornovaci . '"/>
					<rect x="10" y="95" width="100" height="15" fill="' . $upozornovaci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' odbočka k jinému zajímavému místu">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Místní značka
	 */
	private function renderMistniZnacka( string $upozornovaci, string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' místní značka">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<polygon points="10,110 10,10 110,110" fill="' . $upozornovaci . '"/>
					<polygon points="110,10 110,103 17,10" fill="' . $vedouci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' místní značka">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Naučná stezka
	 */
	private function renderNaucnaZnacka( string $upozornovaci, string $vedouci, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="Naučná stezka">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<path d="M88.69,109.988l-78.608,-78.609l0,-21.336l0.056,-0.055l20.979,-0l78.965,78.965l0,21.035l-21.392,-0Z" fill="' . $vedouci . '"/>
					<path d="M10.048,38.416l71.716,71.716l-71.716,0l0,-71.716Zm100,43.432l-71.716,-71.716l71.716,0l0,71.716Z" fill="' . $upozornovaci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="Naučná stezka">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Jezdecká značka (JZT) - kruh v bílém čtverci.
	 * Aktivuje se přesunem JZT (řízeno v renderZnacka), ne tvarem.
	 */
	private function renderJezdeckaZnacka( string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$khaki = $this->colorService->barvaDleKodu( "KH" );
		$bila  = $this->colorService->barvaDleKodu( "BI" );
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="' . $nazev . ' jezdecká značka">
					<rect x="0" y="0" width="120" height="120" fill="' . $khaki . '"/>
					<rect x="10" y="10" width="100" height="100" fill="' . $bila . '"/>
					<circle cx="60" cy="60" r="35" fill="' . $khaki . '"/>
					<circle cx="60" cy="60" r="30" fill="' . $vedouci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="' . $nazev . ' jezdecká značka">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Vozíčkářská značka - symbol vozíčkáře
	 */
	private function renderVozickarskaZnacka( string $vedouci, string $nazev, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" title="' . $nazev . ' vozíčkářská trasa">
					<path d="M16.717,22.218c-1.353,2.067 -3.689,3.433 -6.342,3.433c-4.181,0 -7.575,-3.394 -7.575,-7.575c-0,-2.91 1.643,-5.439 4.052,-6.707l0.437,2.925c-1.096,0.895 -1.796,2.257 -1.796,3.782c0,2.694 2.188,4.881 4.882,4.881c2.651,0 4.811,-2.117 4.88,-4.752l1.462,4.013Zm-10.465,-17.219c-0.195,-0.391 -0.304,-0.833 -0.304,-1.3c-0,-1.617 1.312,-2.93 2.929,-2.93c1.617,0 2.93,1.313 2.93,2.93c-0,1.465 -1.078,2.68 -2.483,2.896l0.636,4.184l5.916,-0.056l-0.023,2.403l-5.51,0.019l0.084,0.675l6.745,-0.003l3.01,8.478l2.61,-0.815l0.668,1.955l-5.327,1.621l-2.951,-8.397l-7.303,-0.005l-1.627,-11.655Z" fill="' . $vedouci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 26 26" title="' . $nazev . ' vozíčkářská trasa">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Prázdná/výchozí značka - jednoduchý čtverec
	 */
	private function renderPrazdnaZnacka( string $upozornovaci, int $size, bool $forPdf = false ): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" title="Neznámé nebo bez značení">
					<rect x="0" y="0" width="120" height="120" fill="' . $this->colorService->barvaDleKodu( "KH" ) . '"/>
					<rect x="10" y="10" width="100" height="100" fill="' . $upozornovaci . '"/>
				</svg>';
		return $forPdf ? $this->wrapSvgForPdf($svg, $size) : '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 120 120" title="Neznámé nebo bez značení">' . substr($svg, strpos($svg, '>') + 1);
	}

	/**
	 * Vygeneruje HTML span s CSS třídami (alternativa k SVG)
	 */
	public function renderZnackaCSS(
		string $barvaKod,
		string $typ = 'pasova',
		string $size = 'md'
	): string {
		return '';
	}

	/**
	 * Zkratka pro rychlé použití v Twig
	 */
	public function znacka(
		?string $barvaKod = '',
		?string $tvar = 'PA',
		?string $presun = 'PZT',
		int $size = 24,
		bool $forPdf = false
	): string {
		return $this->renderZnacka( $barvaKod, $tvar, $presun, $size, $forPdf );
	}
}