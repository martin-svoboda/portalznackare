<?php

namespace App\Service;

use Dompdf\Dompdf;
use Dompdf\Options;
use Twig\Environment;
use Psr\Log\LoggerInterface;

/**
 * Služba pro generování PDF dokumentů
 *
 * Podporuje:
 * - Kontrolní formuláře pro terénní práci
 * - HTML rendering pomocí DomPDF
 */
class PdfGeneratorService
{
    public function __construct(
        private InsyzService $insyzService,
        private DataEnricherService $dataEnricher,
        private Environment $twig,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Generuje kontrolní formulář PDF pro příkaz
     *
     * @param int $idZp ID příkazu z INSYZ
     * @param int $intAdr INT_ADR uživatele
     * @return string PDF obsah jako string
     * @throws \Exception
     */
    public function generateControlFormPdf(int $idZp, int $intAdr): string
    {
        $this->logger->info('Generování kontrolního formuláře PDF', [
            'id_zp' => $idZp,
            'int_adr' => $intAdr
        ]);

        try {
            // Načti data příkazu z INSYZ
            $prikazData = $this->insyzService->getPrikaz($intAdr, $idZp);

            // Obohatit data o HTML značky a TIM náhledy (forPdf = true pro PDF-kompatibilní SVG)
            $enrichedData = $this->dataEnricher->enrichPrikazDetail($prikazData, true);

            // Render HTML template
            $html = $this->twig->render('pdf/control_form.html.twig', [
                'prikaz' => $enrichedData,
                'head' => $enrichedData['head'] ?? [],
                'useky' => $enrichedData['useky'] ?? [],
                'predmety' => $enrichedData['predmety'] ?? [],
                'generated_at' => new \DateTime()
            ]);

            // Konfigurace DomPDF
            $options = new Options();
            $options->set('isHtml5ParserEnabled', true);
            $options->set('isRemoteEnabled', false);
//            $options->set('defaultFont', 'DejaVu Sans'); // Podpora češtiny
            $options->set('chroot', sys_get_temp_dir());
	        $options->set( 'dpi', '144' );

            $dompdf = new Dompdf();
	        $dompdf->setOptions($options);

	        // Načíst HTML
            $dompdf->loadHtml($html);

            // Nastavit formát stránky
            $dompdf->setPaper('A4', 'portrait');

            // Vygenerovat PDF
            $dompdf->render();

            $this->logger->info('Kontrolní formulář PDF vygenerován', [
                'id_zp' => $idZp
            ]);

            // Return jako string
            return $dompdf->output();

        } catch (\Exception $e) {
            $this->logger->error('Chyba při generování PDF', [
                'id_zp' => $idZp,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

}
