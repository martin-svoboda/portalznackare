import React, {useState, useMemo} from "react";
import {
	Stack,
	Card,
	Title,
	Group,
	Text,
	Textarea,
	Select,
	NumberInput,
	Radio,
	Accordion,
	Table,
	Badge,
	Alert,
	Box,
	Grid,
	Collapse,
	Button,
	Progress,
	Image,
	ActionIcon,
	Paper,
	Divider,
	Flex
} from "@mantine/core";
import {
	IconInfoCircle,
	IconChevronDown,
	IconChevronUp,
	IconPhoto,
	IconCheck,
	IconX,
	IconAlertTriangle,
	IconMapPin
} from "@tabler/icons-react";
import {HlaseniFormData, TimReport, TimItemStatus} from "../types/HlaseniTypes";
import {FileUpload} from "./FileUpload";
import {formatKm} from "@utils/formatting";
import {YearPickerInput} from "@mantine/dates";

interface PartBFormProps {
	formData: HlaseniFormData;
	updateFormData: (updates: Partial<HlaseniFormData>) => void;
	head: any;
	useky: any[];
	predmety: any[];
	canEdit: boolean;
	onSave: () => void;
}

const statusOptions = [
	{value: "1", label: "1 - Nová", color: "green"},
	{value: "2", label: "2 - Zachovalá", color: "blue"},
	{value: "3", label: "3 - Nevyhovující", color: "orange"},
	{value: "4", label: "4 - Zcela chybí", color: "red"}
];

const arrowOrientationOptions = [
	{value: "L", label: "Levá (L)"},
	{value: "P", label: "Pravá (P)"}
];

// Helper funkce pro generování konzistentních identifikátorů
const getItemIdentifier = (item: any): string => {
	// Preferujeme ID_PREDMETY z DB, fallback na kombinaci EvCi_TIM + Predmet_Index
	return item.ID_PREDMETY?.toString() || `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

const getLegacyItemIdentifier = (item: any): string => {
	return `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

// Seskupení předmětů podle TIM
const groupItemsByTIM = (predmety: any[]) => {
	const groups: Record<string, any> = {};
	predmety.forEach(item => {
		if (!item.EvCi_TIM) return;
		if (!groups[item.EvCi_TIM]) {
			groups[item.EvCi_TIM] = {
				EvCi_TIM: item.EvCi_TIM,
				Naz_TIM: item.Naz_TIM,
				GPS_Sirka: item.GPS_Sirka,
				GPS_Delka: item.GPS_Delka,
				items: []
			};
		}
		groups[item.EvCi_TIM].items.push(item);
	});
	return Object.values(groups);
};

export const PartBForm: React.FC<PartBFormProps> = ({
														formData,
														updateFormData,
														head,
														useky,
														predmety,
														canEdit,
														onSave
													}) => {
	const [expandedTims, setExpandedTims] = useState<Set<string>>(new Set());

	const totalLength = useMemo(() => {
		if (!Array.isArray(useky) || useky.length === 0) return 0;
		return useky.reduce((sum, usek) => sum + Number(usek.Delka_ZU || 0), 0);
	}, [useky]);

	const timGroups = useMemo(() => groupItemsByTIM(predmety), [predmety]);

	const updateTimReport = (timId: string, updates: Partial<TimReport>) => {
		const newTimReports = {
			...formData.timReports,
			[timId]: {
				...formData.timReports[timId],
				...updates
			}
		};
		updateFormData({timReports: newTimReports});
	};

	const updateItemStatus = (timId: string, item: any, status: Partial<TimItemStatus>) => {
		const timReport = formData.timReports[timId] || {
			timId,
			structuralComment: "",
			structuralAttachments: [],
			itemStatuses: [],
			photos: []
		};

		const primaryId = getItemIdentifier(item);
		const legacyId = getLegacyItemIdentifier(item);

		const existingStatusIndex = timReport.itemStatuses.findIndex(s => 
			s.itemId === primaryId || s.itemId === legacyId || s.legacyItemId === legacyId
		);
		const newItemStatuses = [...timReport.itemStatuses];

		if (existingStatusIndex >= 0) {
			newItemStatuses[existingStatusIndex] = {
				...newItemStatuses[existingStatusIndex],
				...status,
				itemId: primaryId, // Aktualizujeme na nový identifikátor
				legacyItemId: legacyId,
				evCiTim: item.EvCi_TIM,
				predmetIndex: item.Predmet_Index
			};
		} else {
			newItemStatuses.push({
				itemId: primaryId,
				legacyItemId: legacyId,
				evCiTim: item.EvCi_TIM,
				predmetIndex: item.Predmet_Index,
				status: 1,
				...status
			});
		}

		updateTimReport(timId, {
			...timReport,
			itemStatuses: newItemStatuses
		});
	};

	const getItemStatus = (timId: string, item: any): TimItemStatus | undefined => {
		const timReport = formData.timReports[timId];
		if (!timReport) return undefined;

		const primaryId = getItemIdentifier(item);
		const legacyId = getLegacyItemIdentifier(item);

		return timReport.itemStatuses.find(s => 
			s.itemId === primaryId || s.itemId === legacyId || s.legacyItemId === legacyId
		);
	};

	const getTimCompletionStatus = (timId: string) => {
		const timData = timGroups.find(g => g.EvCi_TIM === timId);
		const timReport = formData.timReports[timId];

		if (!timData || !timReport) return {completed: false, total: 0, filled: 0};

		const requiredFields = timData.items.length;
		const filledFields = timReport.itemStatuses.filter(status => {
			if (!status.status) return false;
			if (status.status === 3 || status.status === 4) return true; // Nevyhovující/chybí nevyžadují další údaje

			// Pro stavy 1-2 jsou potřeba další údaje
			const hasYear = status.yearOfProduction && status.yearOfProduction instanceof Date;
			const hasOrientation = !status.itemId.includes('směrovka') || status.arrowOrientation;

			return hasYear && hasOrientation;
		}).length;

		return {
			completed: filledFields === requiredFields,
			total: requiredFields,
			filled: filledFields
		};
	};

	const toggleTimExpansion = (timId: string) => {
		const newExpanded = new Set(expandedTims);
		if (newExpanded.has(timId)) {
			newExpanded.delete(timId);
		} else {
			newExpanded.add(timId);
		}
		setExpandedTims(newExpanded);
	};

	if (!canEdit) {
		return (
			<Alert icon={<IconInfoCircle size={16}/>} color="blue">
				Pouze vedoucí skupiny může vyplňovat část B - Stav TIM.
			</Alert>
		);
	}

	return (
		<Stack gap="md">
			{/* TIM stavy */}
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Stavy TIM</Title>

				{timGroups.length === 0 ? (
					<Alert icon={<IconInfoCircle size={16}/>} color="blue">
						Pro tento příkaz nejsou k dispozici žádné TIM k hodnocení.
					</Alert>
				) : (
					<Stack gap="md">
						{timGroups.map((timGroup) => {
							const isExpanded = expandedTims.has(timGroup.EvCi_TIM);
							const completion = getTimCompletionStatus(timGroup.EvCi_TIM);
							const timReport = formData.timReports[timGroup.EvCi_TIM];

							return (
								<Card key={timGroup.EvCi_TIM} withBorder padding="md">
									<Group justify="space-between" mb="md">
										<Group>
											<IconMapPin size={20}/>
											<Stack gap={0}>
												<Text fw={500}>{timGroup.Naz_TIM}</Text>
												<Text size="sm" c="dimmed">TIM {timGroup.EvCi_TIM}</Text>
											</Stack>
										</Group>
										<Group>
											<Progress
												value={(completion.filled / completion.total) * 100}
												size="sm"
												w={100}
												color={completion.completed ? "green" : "blue"}
											/>
											<Text size="sm">
												{completion.filled}/{completion.total}
											</Text>
											<Button
												variant="subtle"
												size="xs"
												rightSection={isExpanded ? <IconChevronUp size={14}/> :
													<IconChevronDown size={14}/>}
												onClick={() => toggleTimExpansion(timGroup.EvCi_TIM)}
											>
												{isExpanded ? "Skrýt" : "Rozbalit"}
											</Button>
										</Group>
									</Group>

									<Collapse in={isExpanded}>
										<Stack gap="md">
											{/* Komentář k nosnému prvku */}
											<Box>
												<Text fw={500} size="sm" mb="xs">
													Komentář k nosnému prvku
												</Text>
												<Text size="xs" c="dimmed" mb="xs">
													Stav upevnění směrovek a tabulek, např. zarostlá nebo prasklá
													dřevěná lišta,
													silně zkorodovaný nebo uvolněný ocelový upevňovací pás, deformovaný
													trubkový
													držák směrovky, viditelná rez apod.
												</Text>
												<Textarea
													placeholder="Popište stav nosného prvku..."
													value={timReport?.structuralComment || ""}
													onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
														timId: timGroup.EvCi_TIM,
														structuralComment: e.target.value,
														structuralAttachments: timReport?.structuralAttachments || [],
														itemStatuses: timReport?.itemStatuses || [],
														photos: timReport?.photos || []
													})}
													minRows={3}
												/>
												<Box mt="sm">
													<Text size="sm" mb="xs">Fotografické přílohy k nosnému prvku</Text>
													<FileUpload
														id={`structural-${timGroup.EvCi_TIM}`}
														files={timReport?.structuralAttachments || []}
														onFilesChange={(files) => updateTimReport(timGroup.EvCi_TIM, {
															...timReport,
															timId: timGroup.EvCi_TIM,
															structuralAttachments: files
														})}
														maxFiles={5}
														accept="image/jpeg,image/png,image/heic"
													/>
												</Box>
											</Box>

											{/* Středové pravidlo */}
											<Box>
												<Text fw={500} size="sm" mb="xs">
													Umístění TIMu splňuje středové pravidlo
												</Text>
												<Text size="xs" c="dimmed" mb="xs">
													Všechny směrovky jsou viditelné ze středu křižovatky
												</Text>
												<Radio.Group
													value={timReport?.centerRuleCompliant?.toString() || ""}
													onChange={(value) => {
														const compliant = value === "true" ? true : value === "false" ? false : undefined;
														updateTimReport(timGroup.EvCi_TIM, {
															...timReport,
															timId: timGroup.EvCi_TIM,
															centerRuleCompliant: compliant
														});
													}}
												>
													<Group>
														<Radio value="true" label="ANO"/>
														<Radio value="false" label="NE"/>
													</Group>
												</Radio.Group>

												{timReport?.centerRuleCompliant === false && (
													<Textarea
														placeholder="Komentář k nesplnění středového pravidla..."
														value={timReport?.centerRuleComment || ""}
														onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
															...timReport,
															centerRuleComment: e.target.value
														})}
														mt="sm"
														minRows={2}
													/>
												)}
											</Box>

											{/* Tabulky a směrovky */}
											<Box>
												<Text fw={500} size="sm" mb="xs">
													Stav tabulek a směrovek
												</Text>

												<Stack gap={0}>
													{/* Hlavička - pouze na desktopu */}
													<Flex
														visibleFrom="sm"
														gap="md"
														pb="sm"
														style={{borderBottom: '1px solid var(--mantine-color-gray-3)'}}
													>
														<Box style={{flex: '0 0 40%'}}>
															<Text size="sm" fw={600} c="dimmed">Předmět</Text>
														</Box>
														<Box style={{flex: '0 0 20%'}}>
															<Text size="sm" fw={600} c="dimmed">Stav</Text>
														</Box>
														<Box style={{flex: '0 0 20%'}}>
															<Text size="sm" fw={600} c="dimmed">Rok výroby</Text>
														</Box>
														<Box style={{flex: '0 0 20%'}}>
															<Text size="sm" fw={600} c="dimmed">Orientace</Text>
														</Box>
													</Flex>

													{/* Řádky */}
													{timGroup.items.map((item: any, index: number) => {
														const itemStatus = getItemStatus(timGroup.EvCi_TIM, item);
														const isArrow = item.Druh_Predmetu_Naz?.toLowerCase().includes('směrovka');
														const needsAdditionalData = itemStatus?.status === 1 || itemStatus?.status === 2;

														return (
															<Box key={getItemIdentifier(item)}>
																<Flex
																	gap="md"
																	py="md"
																	direction={{base: 'column', sm: 'row'}}
																	align={{base: 'stretch', sm: 'center'}}
																>
																	{/* Předmět */}
																	<Box w={{base: '100%', sm: '40%'}}>
																		<Text size="xs" fw={600} c="dimmed"
																			  hiddenFrom="sm" mb={5}>
																			Předmět
																		</Text>

																		<Stack gap={0}>
																			<Group>
																				<Text size="sm" fw={700}>
																					{item.EvCi_TIM}{item.Predmet_Index}
																				</Text>
																				{item.ID_PREDMETY && (
																					<Text size="xs" c="dimmed" fw={400}>
																						(ID: {item.ID_PREDMETY})
																					</Text>
																				)}
																				<Text size="sm" fw={500}>
																					{item.Radek1}
																				</Text>
																			</Group>
																			<Group gap="xs">
																				{item.Druh_Predmetu_Naz && (
																					<Badge size="sm"
																						   variant="light">
																						{item.Druh_Predmetu_Naz}
																					</Badge>
																				)}
																				{item.Druh_Presunu && (
																					<Badge size="sm"
																						   variant="light">
																						{item.Druh_Presunu}
																					</Badge>
																				)}
																				{item.Barva && (
																					<Badge size="sm"
																						   variant="light">
																						{item.Barva}
																					</Badge>
																				)}
																			</Group>
																		</Stack>

																	</Box>

																	{/* Stav */}
																	<Group w={{base: '100%', sm: '20%'}}>
																		<Text w={80} size="xs" fw={600} c="dimmed"
																			  hiddenFrom="sm" mb={5}>
																			Stav
																		</Text>
																		<Select
																			placeholder="Vyberte stav"
																			data={statusOptions}
																			value={itemStatus?.status?.toString() || ""}
																			onChange={(value) => value && updateItemStatus(
																				timGroup.EvCi_TIM,
																				item,
																				{status: parseInt(value) as any}
																			)}
																			size="sm"
																			flex="1"
																		/>
																	</Group>

																	{/* Rok výroby */}
																	<Group w={{base: '100%', sm: '20%'}}>

																		<Text w={80} size="xs" fw={600} c="dimmed"
																			  hiddenFrom="sm" mb={5}>
																			Rok výroby
																		</Text>
																		{needsAdditionalData ? (
																			<YearPickerInput
																				placeholder="Rok"
																				value={itemStatus?.yearOfProduction || undefined}
																				onChange={(value) => updateItemStatus(
																					timGroup.EvCi_TIM,
																					item,
																					{yearOfProduction: value || undefined}
																				)}
																				minDate={new Date(1990, 1)}
																				maxDate={new Date()}
																				clearable
																				size="sm"
																				flex="1"
																			/>
																		) : (
																			<Text size="sm" c="dimmed"
																				  hiddenFrom="sm">-</Text>
																		)}
																	</Group>

																	{/* Orientace */}
																	<Group w={{base: '100%', sm: '20%'}}>
																		<Text w={80} size="xs" fw={600} c="dimmed"
																			  hiddenFrom="sm" mb={5}>
																			Orientace směrovky
																		</Text>
																		{needsAdditionalData && isArrow ? (
																			<Select
																				placeholder="L/P"
																				data={arrowOrientationOptions}
																				value={itemStatus?.arrowOrientation || ""}
																				onChange={(value) => updateItemStatus(
																					timGroup.EvCi_TIM,
																					item,
																					{arrowOrientation: value as "L" | "P"}
																				)}
																				size="sm"
																				flex="1"
																			/>
																		) : (
																			<Text size="sm" c="dimmed"
																				  hiddenFrom="sm">-</Text>
																		)}
																	</Group>
																</Flex>
																<Divider/>
															</Box>
														);
													})}
												</Stack>

												{completion.completed && (
													<Alert icon={<IconCheck size={16}/>} color="green" mt="sm">
														Hlášení o obnově TZT pro tento TIM je kompletní.
													</Alert>
												)}
											</Box>

											{/* Komentář k TIMu */}
											<Box>
												<Text fw={500} size="sm" mb="xs">
													Obecný komentář k TIMu
												</Text>
												<Textarea
													placeholder="Dodatečné poznámky k tomuto TIMu..."
													value={timReport?.generalComment || ""}
													onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
														...timReport,
														timId: timGroup.EvCi_TIM,
														generalComment: e.target.value
													})}
													minRows={2}
												/>
											</Box>

											{/* Fotografie TIMu */}
											<Box>
												<Text fw={500} size="sm" mb="xs">
													Fotografie TIMu
												</Text>
												<FileUpload
													id={`photos-${timGroup.EvCi_TIM}`}
													files={timReport?.photos || []}
													onFilesChange={(files) => updateTimReport(timGroup.EvCi_TIM, {
														...timReport,
														timId: timGroup.EvCi_TIM,
														photos: files
													})}
													maxFiles={10}
													accept="image/jpeg,image/png,image/heic"
												/>
											</Box>
										</Stack>
									</Collapse>
								</Card>
							);
						})}
					</Stack>
				)}
			</Card>

			{/* Komentář ke značkařskému úseku */}
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Komentář ke značkařskému úseku</Title>

				<Text size="sm" c="dimmed" mb="md">
					<strong>Nápověda k vyplnění:</strong><br/>
					• Místa, která by podle nynějšího stavu v terénu mohla být vyznačkována účelněji<br/>
					• Místa, která nemohla být spolehlivě vyznačkována s návrhem na opatření<br/>
					• Místa zhoršené schůdnosti nebo průchodnosti s návrhem na opatření
				</Text>

				<Textarea
					placeholder="Popište stav značkařského úseku a případné návrhy na zlepšení..."
					value={formData.routeComment}
					onChange={(e) => updateFormData({routeComment: e.target.value})}
					minRows={4}
					mb="md"
				/>

				<Box mb="md">
					<Text fw={500} size="sm" mb="xs">
						Fotografické přílohy k úseku
					</Text>
					<FileUpload
						id="route-attachments"
						files={formData.routeAttachments || []}
						onFilesChange={(files) => updateFormData({routeAttachments: files})}
						maxFiles={10}
						accept="image/jpeg,image/png,image/heic"
					/>
				</Box>

				<Box>
					<Text fw={500} size="sm" mb="xs">
						Průběh značené trasy v terénu
					</Text>
					<Text size="sm" c="dimmed" mb="xs">
						Souhlasí průběh trasy s jejím zákresem v posledním vydání turistické mapy KČT a s průběhem trasy
						na mapy.cz?
					</Text>
					<Radio.Group
						value={formData.routeComment ? "ano" : ""}
						onChange={(value) => {
							// Toto by mělo být vlastní pole v formData
							// Pro demo účely používáme routeComment
						}}
					>
						<Group>
							<Radio value="ano" label="ANO"/>
							<Radio value="ne" label="NE"/>
						</Group>
					</Radio.Group>
				</Box>
			</Card>
		</Stack>
	);
};