<?php

namespace App\Service;

use App\Enum\ReportStateEnum;
use App\Repository\ReportRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Služba pro obohacování dat o HTML komponenty
 * Používá se v API controllerech
 */
class DataEnricherService {
	private const STAVY_PRO_ZPRACOVANI = ['Přidělený', 'Vystavený'];
	private const HLASENI_ODESLANE_STAVY = ['send', 'submitted', 'approved'];
	private const STAVY_ZPRACOVANE = ['Provedený', 'Předaný KKZ', 'Zaúčtovaný'];

	public function __construct(
		private ZnackaService $znackaService,
		private TimService $timService,
		private TransportIconService $transportIconService,
		private ReportRepository $reportRepository,
		private EntityManagerInterface $entityManager
	) {
	}

	/**
	 * Obohatí data seznamu příkazů
	 */
	public function enrichPrikazyList( array $prikazy ): array {
		$prikazy = array_map( [ $this, 'enrichPrikazData' ], $prikazy );

		// Hromadně zpracovat stavy hlášení
		$idZpMap = []; // id_zp => stav příkazu
		foreach ( $prikazy as $prikaz ) {
			$idZp = (int) ( $prikaz['ID_Znackarske_Prikazy'] ?? 0 );
			if ( $idZp > 0 ) {
				$idZpMap[ $idZp ] = $prikaz['Stav_ZP_Naz'] ?? '';
			}
		}

		$this->syncReportStates( $idZpMap );
		$reportStates = $this->reportRepository->getReportStatesForOrders( array_keys( $idZpMap ) );

		foreach ( $prikazy as &$prikaz ) {
			$idZp = (int) ( $prikaz['ID_Znackarske_Prikazy'] ?? 0 );
			$prikaz['Stav_Virtualni'] = $this->resolveVirtualniStav(
				$prikaz['Stav_ZP_Naz'] ?? '',
				$reportStates[ $idZp ] ?? null
			);
		}

		return $prikazy;
	}

	/**
	 * Obohatí jednotlivý příkaz v seznamu
	 */
	private function enrichPrikazData( array $prikaz, bool $forPdf = false ): array {
		// Nahradí ikony v popisu příkazu
		if ( isset( $prikaz['Popis_ZP'] ) ) {
			$prikaz['Popis_ZP'] = $this->replaceIconsInText( $prikaz['Popis_ZP'], $forPdf );
		}

		// Můžeme přidat další pole podle potřeby
		if ( isset( $prikaz['Poznamka'] ) ) {
			$prikaz['Poznamka'] = $this->replaceIconsInText( $prikaz['Poznamka'], $forPdf );
		}

		return $prikaz;
	}

	/**
	 * Obohatí detail příkazu s předměty
	 */
	public function enrichPrikazDetail( array $detail, bool $forPdf = false ): array {
		// Obohatí hlavičku
		if ( isset( $detail['head'] ) && isset( $detail['head']['Popis_ZP'] ) ) {
			$detail['head']['Popis_ZP'] = $this->replaceIconsInText( $detail['head']['Popis_ZP'], $forPdf );
		}

		// Virtuální stav (klíč má různý case v seznamu vs detailu)
		$idZp = $detail['head']['ID_Znackarske_Prikazy'] ?? $detail['head']['ID_Znackarske_prikazy'] ?? null;
		if ( $idZp !== null ) {
			$idZp = (int) $idZp;
			$stavZp = $detail['head']['Stav_ZP_Naz'] ?? '';

			$this->syncReportStates( [ $idZp => $stavZp ] );
			$reportStates = $this->reportRepository->getReportStatesForOrders( [ $idZp ] );

			$detail['head']['Stav_Virtualni'] = $this->resolveVirtualniStav(
				$stavZp,
				$reportStates[ $idZp ] ?? null
			);
		}

		// Obohatí useky
		if ( isset( $detail['useky'] ) && is_array( $detail['useky'] ) ) {
			$detail['useky'] = array_map( function ( $usek ) use ( $forPdf ) {
				// Značka úseku
				$usek['Znacka_HTML'] = $this->znackaService->znacka(
					$usek['Barva_Kod'] ?? null,
					( $usek['Druh_Odbocky_Kod'] ?? null ) ?: ( $usek['Druh_Znaceni_Kod'] ?? null ) ?: null,
					$usek['Druh_Presunu'] ?? null,
					24,
					$forPdf
				);

				// Název úseku s ikonami
				if ( isset( $usek['Nazev_ZU'] ) ) {
					$usek['Nazev_ZU'] = $this->replaceIconsInText( $usek['Nazev_ZU'], $forPdf );
				}

				return $usek;
			}, $detail['useky'] );
		}

		// Obohatí předměty
		if ( isset( $detail['predmety'] ) ) {
			$detail['predmety'] = array_map( function ( $predmet ) use ( $forPdf ) {
				$predmet['Tim_HTML'] = '';

				// Značka podle barvy
				$predmet['Znacka_HTML'] = $this->znackaService->znacka(
					$predmet['Barva_Kod'] ?? null,
					( $predmet['Druh_Odbocky_Kod'] ?? null ) ?: ( $predmet['Druh_Znaceni_Kod'] ?? null ) ?: null,
					$predmet['Druh_Presunu'] ?? null,
					24,
					$forPdf
				);

				// náhledy TIM
				if ( isset( $predmet['Radek1'] ) ) {
					$predmet['Tim_HTML'] = $this->timService->timPreview( $predmet, $forPdf );
				}

				// Název TIM s ikonami
				if ( isset( $predmet['Naz_TIM'] ) ) {
					$predmet['Naz_TIM'] = $this->replaceIconsInText( $predmet['Naz_TIM'], $forPdf );
				}

				// Texty TIM s ikonami
				if ( isset( $predmet['Radek1'] ) ) {
					$predmet['Radek1'] = $this->replaceIconsInText( $predmet['Radek1'], $forPdf );
				}
				if ( isset( $predmet['Radek2'] ) ) {
					$predmet['Radek2'] = $this->replaceIconsInText( $predmet['Radek2'], $forPdf );
				}
				if ( isset( $predmet['Radek3'] ) ) {
					$predmet['Radek3'] = $this->replaceIconsInText( $predmet['Radek3'], $forPdf );
				}

				return $predmet;
			}, $detail['predmety'] );
		}

		return $detail;
	}

	/**
	 * Určí virtuální stav příkazu na základě stavu v INSYZ a stavu hlášení.
	 */
	private function resolveVirtualniStav( string $stavZp, ?string $reportState ): string {
		if (
			in_array( $stavZp, self::STAVY_PRO_ZPRACOVANI, true ) &&
			$reportState !== null &&
			in_array( $reportState, self::HLASENI_ODESLANE_STAVY, true )
		) {
			return 'Odeslaný';
		}

		return $stavZp;
	}

	/**
	 * Hromadná synchronizace stavů hlášení na základě INSYZ.
	 * Pokud příkaz postoupil na Provedený/Předaný KKZ/Zaúčtovaný
	 * a hlášení je ve stavu submitted, automaticky ho přepne na approved.
	 *
	 * @param array<int, string> $idZpToStav mapa id_zp => stav příkazu v INSYZ
	 */
	private function syncReportStates( array $idZpToStav ): void {
		// Filtrovat jen zpracované stavy
		$zpracovane = array_filter( $idZpToStav, fn( $stav ) => in_array( $stav, self::STAVY_ZPRACOVANE, true ) );
		if ( empty( $zpracovane ) ) {
			return;
		}

		$reports = $this->reportRepository->findBy( [
			'idZp'  => array_keys( $zpracovane ),
			'state' => ReportStateEnum::SUBMITTED,
		] );

		if ( empty( $reports ) ) {
			return;
		}

		foreach ( $reports as $report ) {
			$report->setState( ReportStateEnum::APPROVED );
			$report->addHistoryEntry(
				'auto_approved',
				0,
				'Automaticky schváleno na základě stavu příkazu v INSYZ: ' . $zpracovane[ $report->getIdZp() ]
			);
		}

		$this->entityManager->flush();
	}

	/**
	 * Nahradí zkratky v textu za ikony
	 * Nahrazuje pouze dopravní ikony ve formátu &TAG
	 */
	private function replaceIconsInText( ?string $text, bool $forPdf = false ): string {
		if ( empty( $text ) ) {
			return '';
		}

		// Nahraď dopravní ikony (&BUS, &ŽST, atd.)
		return $this->transportIconService->replaceIconsInText( $text, 10, false, $forPdf );
	}
}