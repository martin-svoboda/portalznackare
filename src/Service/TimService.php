<?php

namespace App\Service;

/**
 * Služba pro renderování TIM náhledů
 * 1:1 převod z WP-src/portal/components/NahledTim.tsx a TimArrowShape.tsx
 */
class TimService {
	
	public function __construct(
		private TransportIconService $transportIconService,
		private ColorService $colorService
	) {
	}

	/**
	 * Vygeneruje SVG tvar šipky podle tvaru značky
	 * 1:1 převod z TimArrowShape.tsx
	 */
	private function renderTimArrowShape( string $color, string $shape = 'PA' ): string {
		switch ( $shape ) {
			case "PA":
			case "CT":
			case "DO":
				return '<svg width="40" height="25" viewBox="0 0 40 25">
							<polygon points="0,0 0,25 40,25 40,0" fill="' . $color . '"/>
						</svg>';

			case "NS":
			case "SN":
				return '<svg width="25" height="25" viewBox="0 0 26 26">
							<rect x="0.905" y="0.758" width="24.979" height="25.018" fill="' . $color . '"/>
							<path d="M1.621,7.261l17.864,17.864l-17.864,-0l0,-17.864Zm23.526,12.102l-17.865,-17.864l17.865,-0l-0,17.864Z" fill="#fff"/>
						</svg>';

			case "Z":
				return '<svg width="40" height="26" viewBox="0 0 26 26">
							<path d="M13.481,13.21l0,-12.407l-12.407,-0l-0,24.815l24.815,0l0,-12.408l-12.408,0Z" fill="' . $color . '"/>
						</svg>';

			case "S":
				return '<svg width="40" height="26" viewBox="0 0 26 26">
							<path d="M25.624,11.825l0,0.005c0,7.029 -5.56,12.735 -12.409,12.735c-6.849,0 -12.409,-5.706 -12.409,-12.735l-0,-0.005l24.818,-0Z" fill="' . $color . '"/>
						</svg>';

			case "V":
				return '<svg width="40" height="26" viewBox="0 0 26 26">
							<path d="M12.948,2.405l12.355,22.649l-24.709,0l12.354,-22.649Z" fill="' . $color . '"/>
						</svg>';

			case "P":
				return '<svg width="40" height="26" viewBox="0 0 26 26">
							<path d="M17.664,13.21l-0,-9.964l-9.964,0l-0,9.964l-7.532,0l0,9.964l25.056,0l-0,-9.964l-7.56,0Z" fill="' . $color . '"/>
						</svg>';

			case "MI":
				return '<svg width="40" height="26" viewBox="0 0 26 26">
							<rect x="0.02" y="0.758" width="24.979" height="25.018" fill="' . $color . '"/>
							<path d="M0.649,1.151l24.06,24.06l-24.06,0l-0,-24.06Z" style="fill:#fff;"/>
						</svg>';

			case "VO":
				return '<svg width="40" height="26" viewBox="0 0 26 26">
							<path d="M16.717,22.218c-1.353,2.067 -3.689,3.433 -6.342,3.433c-4.181,0 -7.575,-3.394 -7.575,-7.575c-0,-2.91 1.643,-5.439 4.052,-6.707l0.437,2.925c-1.096,0.895 -1.796,2.257 -1.796,3.782c0,2.694 2.188,4.881 4.882,4.881c2.651,0 4.811,-2.117 4.88,-4.752l1.462,4.013Zm-10.465,-17.219c-0.195,-0.391 -0.304,-0.833 -0.304,-1.3c-0,-1.617 1.312,-2.93 2.929,-2.93c1.617,0 2.93,1.313 2.93,2.93c-0,1.465 -1.078,2.68 -2.483,2.896l0.636,4.184l5.916,-0.056l-0.023,2.403l-5.51,0.019l0.084,0.675l6.745,-0.003l3.01,8.478l2.61,-0.815l0.668,1.955l-5.327,1.621l-2.951,-8.397l-7.303,-0.005l-1.627,-11.655Z" fill="' . $color . '"/>
						</svg>';

			default:
				return '';
		}
	}

	/**
	 * Získá řádky z TIM položky
	 * 1:1 převod z getItemLines funkce
	 */
	private function getItemLines( array $item ): array {
		$lines = [];
		
		for ( $i = 1; $i <= 3; $i++ ) {
			$text = isset( $item["Radek{$i}"] ) ? trim( $item["Radek{$i}"] ) : null;
			$km   = isset( $item["KM{$i}"] ) && (float) $item["KM{$i}"] > 0 ? $this->formatKm( $item["KM{$i}"] ) : null;
			
			if ( $text ) {
				$lines[] = [ 'text' => $text, 'km' => $km ];
			}
		}
		
		return $lines;
	}

	/**
	 * Formátuje kilometráž
	 */
	private function formatKm( $km ): string {
		return $km ? number_format( (float) $km, 1, '.', '' ) : '0';
	}

	/**
	 * Určí barvu podkladu podle druhu přesunu
	 * 1:1 převod z barvaPodkladu funkce
	 */
	private function getBarvaPodkladu( ?string $druhPresunu ): string {
		if ( ! $druhPresunu ) {
			return '#fff4e6'; // orange.0
		}
		
		$v = strtoupper( trim( $druhPresunu ) );
		
		switch ( $v ) {
			case "PZT":
				return '#fff4e6'; // orange.0
			case "LZT":
				return '#ffa94d'; // orange.5
			case "CZT":
			case "CZS":
				return '#ffd43b'; // yellow.4
			default:
				return '#fff4e6'; // orange.0
		}
	}

	/**
	 * Zpracuje text a nahradí ikony, rozdělí závorky
	 * 1:1 převod z renderTextContent funkce
	 */
	private function renderTextContent( string $text, bool $hideIcon = false ): string {
		if ( empty( $text ) ) {
			return '';
		}

		// Nejprve nahraď dopravní ikony (nebo je odeber pokud hideIcon = true)
		$text = $this->transportIconService->replaceIconsInText( $text, 10, $hideIcon );

		// Rozdělí text podle závorek a obalí malé části do <small>
		$parts = preg_split( '/(\([^)]*\))/', $text, -1, PREG_SPLIT_DELIM_CAPTURE );
		$result = '';

		foreach ( $parts as $part ) {
			if ( preg_match( '/^\([^)]*\)$/', $part ) ) {
				$result .= '<small>' . $part . '</small>';
			} else {
				$result .= $part;
			}
		}

		return $result;
	}

	/**
	 * Vygeneruje kompletní TIM náhled
	 * 1:1 převod z NahledTim komponenty
	 */
	public function timPreview( array $item ): string {
		$lines     = $this->getItemLines( $item );
		$showArrow = ( $item['Druh_Predmetu'] ?? '' ) === "S" || ( $item['Druh_Predmetu'] ?? '' ) === "D";
		$direction = $item['Smerovani'] ?? '';

		$vedouciBarva = isset( $item['Barva_Kod'] ) && !empty( $item['Barva_Kod'] ) ? $this->colorService->barvaDleKodu( $item['Barva_Kod'] ) : 'transparent';
		$barvaPodkladu = $this->getBarvaPodkladu( $item['Druh_Presunu'] ?? null );

		// Styly pro TIM kontejner
		$itemStyle = 'padding: 5px;';
		$shapeStyle = 'display: none;';
		$clipPath = '';

		// Nastavení stylů podle směru šipky
		if ( $showArrow && $direction === "L" ) {
			$itemStyle = 'padding: 5px 5px 5px 50px;';
			$clipPath = 'clip-path: polygon(45px 0, 100% 0, 100% 100%, 45px 100%, 0px 50%);';
			$shapeStyle = 'position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 40px; height: 25px; display: flex; justify-content: end;';
		}
		
		if ( $showArrow && $direction === "P" ) {
			$itemStyle = 'padding: 5px 50px 5px 5px;';
			$clipPath = 'clip-path: polygon(calc(100% - 45px) 0, 100% 50%, calc(100% - 45px) 100%, 0 100%, 0 0);';
			$shapeStyle = 'position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 40px; height: 25px; display: flex; justify-content: start;';
		}

		// Začátek HTML
		$html = '<div style="display: flex; align-items: center;">';
		
		// Hlavní TIM kontejner
		$html .= '<div style="' . $itemStyle . $clipPath . ' background-color: ' . $barvaPodkladu . '; border: 1px solid #ccc; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">';

		// Šipka pokud je potřeba
		if ( $showArrow && $direction ) {
			$shape = ($item['Druh_Odbocky_Kod'] ?? null) ?: ($item['Druh_Znaceni_Kod'] ?? null) ?: 'PA';
			$html .= '<div style="' . $shapeStyle . '">';
			$html .= $this->renderTimArrowShape( $vedouciBarva, $shape );
			$html .= '</div>';
		}

		// Obsah TIM
		$html .= '<div style="display: flex; flex-direction: column; gap: 0;">';
		$html .= '<div style="width: 210px; min-height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center;">';

		// Řádky s textem
		if ( count( $lines ) > 0 ) {
			foreach ( $lines as $idx => $line ) {
				// Konstanty pro scale transformaci
				$longTextThreshold = 24;
				$scaleCompressed = 0.75;
				$scaleNormal = 0.85;
				$currentScale = strlen( $line['text'] ?? '' ) > $longTextThreshold ? $scaleCompressed : $scaleNormal;
				
				// Velikost textu
				$textSize = ( $item['Druh_Predmetu'] ?? '' ) === "M" ? ( $idx === 0 ? "20px" : "12px" ) : "14px";
				$fontWeight = "700";

				$html .= '<div style="display: flex; justify-content: ' . ( $line['km'] ? 'space-between' : 'center' ) . '; width: 100%; min-height: 16px; position: relative; align-items: center;">';

				if ( $line['km'] ) {
					// Text s kilometrážou
					$html .= '<div style="display: flex; justify-content: flex-start; flex: 1;">';
					$html .= '<div style="position: absolute; top: 0; width: 120%;">';
					$html .= '<span style="font-weight: ' . $fontWeight . '; font-size: ' . $textSize . '; color: black; transform: scaleX(' . $currentScale . '); white-space: nowrap; transform-origin: left center; display: inline-block;">';
					$html .= $this->renderTextContent( $line['text'] );
					$html .= '</span>';
					$html .= '</div>';
					$html .= '</div>';
					$html .= '<span style="font-size: ' . $textSize . '; color: black;">' . $line['km'] . ' km</span>';
				} elseif ( ( $item['Druh_Predmetu'] ?? '' ) === "M" && $idx === 0 ) {
					// Speciální případ pro M typ, první řádek
					$html .= '<div style="position: absolute; bottom: -7px; width: 120%;">';
					$html .= '<span style="text-align: center; font-weight: ' . $fontWeight . '; font-size: ' . $textSize . '; color: black; transform: scaleX(' . $scaleCompressed . '); transform-origin: center; display: inline-block; width: 100%;">';
					$html .= $this->renderTextContent( $line['text'], true ); // hideIcon = true
					$html .= '</span>';
					$html .= '</div>';
				} else {
					// Běžný text
					$html .= '<span style="text-align: center; font-weight: ' . $fontWeight . '; font-size: ' . $textSize . '; color: black; transform: scaleX(' . $scaleNormal . '); transform-origin: center; display: inline-block;">';
					$html .= $this->renderTextContent( $line['text'] );
					$html .= '</span>';
				}

				$html .= '</div>';
			}
		} else {
			$html .= '<span style="font-size: 14px; color: #666; text-align: center;">Žádný popis</span>';
		}

		$html .= '</div>'; // konec flex kontejneru pro řádky

		// Spodní řádek s rokem a ID
		$html .= '<div style="display: flex; justify-content: space-between; width: 100%; min-height: 16px; align-items: center;">';
		$html .= '<span style="text-align: center; font-size: 10px; color: black;">' . ( $item['Rok_Vyroby'] ?? '' ) . '</span>';
		$html .= '<span style="text-align: right; font-size: 10px; color: black;">' . ( $item['EvCi_TIM'] ?? '' ) . ( $item['Predmet_Index'] ?? '' ) . '</span>';
		$html .= '</div>';

		$html .= '</div>'; // konec obsahu
		$html .= '</div>'; // konec hlavního kontejneru
		$html .= '</div>'; // konec flex wrapperu

		return $html;
	}
}