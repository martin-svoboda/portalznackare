import { useState } from 'react';
import { notifications } from '@mantine/notifications';

export const usePdfGenerator = () => {
	const [isGenerating, setIsGenerating] = useState(false);

	const generatePDF = async (elementId: string, filename: string = 'prikaz.pdf') => {
		setIsGenerating(true);
		
		try {
			const [
				{ default: html2canvas },
				{ default: jsPDF }
			] = await Promise.all([
				import('html2canvas'),
				import('jspdf')
			]);

			const element = document.getElementById(elementId);
			if (!element) {
				throw new Error('Element pro tisk nebyl nalezen');
			}

			// Vygenerujeme celou komponentu najednou
			const canvas = await html2canvas(element, {
				scale: 2,
				useCORS: true,
				allowTaint: true,
				backgroundColor: '#ffffff',
				logging: false,
				width: element.scrollWidth,
				height: element.scrollHeight
			});

			// A4 rozměry v mm
			const imgWidth = 210;
			const pageHeight = 297;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;
			let heightLeft = imgHeight;

			const pdf = new jsPDF('p', 'mm', 'a4');
			let position = 0;

			// Přidej první stránku
			pdf.addImage(
				canvas.toDataURL('image/png'),
				'PNG',
				0,
				position,
				imgWidth,
				imgHeight,
				undefined,
				'FAST'
			);
			heightLeft -= pageHeight;

			// Pokud obsah přesahuje jednu stránku, přidej další stránky
			while (heightLeft >= 0) {
				position = heightLeft - imgHeight;
				pdf.addPage();
				pdf.addImage(
					canvas.toDataURL('image/png'),
					'PNG',
					0,
					position,
					imgWidth,
					imgHeight,
					undefined,
					'FAST'
				);
				heightLeft -= pageHeight;
			}

			pdf.save(filename);
			
			notifications.show({
				title: 'Úspěch',
				message: 'PDF bylo úspěšně vygenerováno',
				color: 'green'
			});

		} catch (error) {
			console.error('Chyba při generování PDF:', error);
			notifications.show({
				title: 'Chyba',
				message: 'Nepodařilo se vygenerovat PDF',
				color: 'red'
			});
		} finally {
			setIsGenerating(false);
		}
	};

	return {
		generatePDF,
		isGenerating
	};
};