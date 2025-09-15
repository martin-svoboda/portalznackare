<?php

namespace App\Service;

/**
 * Služba pro obohacování dat o HTML komponenty
 * Používá se v API controllerech
 */
class DataEnricherService {
	public function __construct(
		private ZnackaService $znackaService,
		private TimService $timService,
		private TransportIconService $transportIconService
	) {
	}

	/**
	 * Obohatí data seznamu příkazů
	 */
	public function enrichPrikazyList( array $prikazy ): array {
		return array_map( [ $this, 'enrichPrikazData' ], $prikazy );
	}

	/**
	 * Obohatí jednotlivý příkaz v seznamu
	 */
	private function enrichPrikazData( array $prikaz ): array {
		// Nahradí ikony v popisu příkazu
		if ( isset( $prikaz['Popis_ZP'] ) ) {
			$prikaz['Popis_ZP'] = $this->replaceIconsInText( $prikaz['Popis_ZP'] );
		}

		// Můžeme přidat další pole podle potřeby
		if ( isset( $prikaz['Poznamka'] ) ) {
			$prikaz['Poznamka'] = $this->replaceIconsInText( $prikaz['Poznamka'] );
		}

		return $prikaz;
	}

	/**
	 * Obohatí detail příkazu s předměty
	 */
	public function enrichPrikazDetail( array $detail ): array {
		// Obohatí hlavičku
		if ( isset( $detail['head'] ) && isset( $detail['head']['Popis_ZP'] ) ) {
			// nic co by se dalo obohatit
			$detail['head']['Popis_ZP'] = $this->replaceIconsInText( $detail['head']['Popis_ZP'] );
		}

		// Obohatí useky
		if ( isset( $detail['useky'] ) && is_array( $detail['useky'] ) ) {
			$detail['useky'] = array_map( function ( $usek ) {
				// Značka úseku
				$usek['Znacka_HTML'] = $this->znackaService->znacka(
					$usek['Barva_Kod'] ?? null,
					( $usek['Druh_Odbocky_Kod'] ?? null ) ?: ( $usek['Druh_Znaceni_Kod'] ?? null ) ?: null,
					$usek['Druh_Presunu'] ?? null,
					24
				);

				// Název úseku s ikonami
				if ( isset( $usek['Nazev_ZU'] ) ) {
					$usek['Nazev_ZU'] = $this->replaceIconsInText( $usek['Nazev_ZU'] );
				}

				return $usek;
			}, $detail['useky'] );
		}

		// Obohatí předměty
		if ( isset( $detail['predmety'] ) ) {
			$detail['predmety'] = array_map( function ( $predmet ) {
				$predmet['Tim_HTML'] = '';

				// Značka podle barvy
				$predmet['Znacka_HTML'] = $this->znackaService->znacka(
					$predmet['Barva_Kod'] ?? null,
					( $predmet['Druh_Odbocky_Kod'] ?? null ) ?: ( $predmet['Druh_Znaceni_Kod'] ?? null ) ?: null,
					$predmet['Druh_Presunu'] ?? null,
					24
				);

				// náhledy TIM
				if ( isset( $predmet['Radek1'] ) ) {
					$predmet['Tim_HTML'] = $this->timService->timPreview( $predmet );
				}

				// Název TIM s ikonami
				if ( isset( $predmet['Naz_TIM'] ) ) {
					$predmet['Naz_TIM'] = $this->replaceIconsInText( $predmet['Naz_TIM'] );
				}

				// Texty TIM s ikonami
				if ( isset( $predmet['Radek1'] ) ) {
					$predmet['Radek1'] = $this->replaceIconsInText( $predmet['Radek1'] );
				}
				if ( isset( $predmet['Radek2'] ) ) {
					$predmet['Radek2'] = $this->replaceIconsInText( $predmet['Radek2'] );
				}
				if ( isset( $predmet['Radek3'] ) ) {
					$predmet['Radek3'] = $this->replaceIconsInText( $predmet['Radek3'] );
				}

				return $predmet;
			}, $detail['predmety'] );
		}

		return $detail;
	}

	/**
	 * Nahradí zkratky v textu za ikony
	 * Nahrazuje pouze dopravní ikony ve formátu &TAG
	 */
	private function replaceIconsInText( ?string $text ): string {
		if ( empty( $text ) ) {
			return '';
		}

		// Nahraď dopravní ikony (&BUS, &ŽST, atd.)
		return $this->transportIconService->replaceIconsInText( $text );
	}
}