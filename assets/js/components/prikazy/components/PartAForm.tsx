import React, {useMemo, ErrorInfo, Component} from "react";
import {
	Stack,
	Card,
	Title,
	Group,
	Text,
	Button,
	TextInput,
	Select,
	NumberInput,
	Divider,
	ActionIcon,
	Alert,
	Grid,
	Box,
	Checkbox,
	ThemeIcon
} from "@mantine/core";
import {
	IconPlus,
	IconTrash,
	IconCopy,
	IconCar,
	IconBus,
	IconWalk,
	IconBike,
	IconInfoCircle,
	IconMapPin,
	IconArrowUp,
	IconArrowDown
} from "@tabler/icons-react";
import {DatePickerInput} from "@mantine/dates";
import {HlaseniFormData, TravelSegment, Accommodation, AdditionalExpense, FileAttachment} from "../types/HlaseniTypes";
import {FileUpload} from "./FileUpload";
import '@mantine/dates/styles.css';
import 'dayjs/locale/cs';
import dayjs from 'dayjs';

// Set Czech locale globally for dayjs
dayjs.locale('cs');

// Error boundary component to catch React error #300
class RenderErrorBoundary extends Component<
	{children: React.ReactNode; sectionName: string},
	{hasError: boolean; error?: Error; errorInfo?: ErrorInfo}
> {
	constructor(props: {children: React.ReactNode; sectionName: string}) {
		super(props);
		this.state = {hasError: false};
	}

	static getDerivedStateFromError(error: Error) {
		return {hasError: true, error};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({error, errorInfo});
	}

	render() {
		if (this.state.hasError) {
			return (
				<Alert color="red" title={`Chyba v sekci: ${this.props.sectionName}`}>
					<Text size="sm">
						Nastala chyba při vykreslování. Zkuste obnovit stránku.
					</Text>
					{this.state.error && (
						<Text size="xs" c="dimmed" mt="sm">
							{this.state.error.message}
						</Text>
					)}
				</Alert>
			);
		}

		return this.props.children;
	}
}

interface PartAFormProps {
	formData: HlaseniFormData;
	updateFormData: (updates: Partial<HlaseniFormData>) => void;
	priceList: any;
	head: any;
	canEdit: boolean;
	canEditOthers: boolean;
	currentUser?: any; // Aktuální přihlášený uživatel
}

const transportTypeOptions = [
	{value: "AUV", label: "AUV (Auto vlastní)", icon: IconCar},
	{value: "AUV-Z", label: "AUV-Z (Auto zaměstnavatele)", icon: IconCar},
	{value: "veřejná doprava", label: "Veřejná doprava", icon: IconBus},
	{value: "pěšky", label: "Pěšky", icon: IconWalk},
	{value: "kolo", label: "Kolo", icon: IconBike},
];

export const PartAForm: React.FC<PartAFormProps> = ({
														formData,
														updateFormData,
														priceList: _priceList,
														head,
														canEdit,
														canEditOthers,
														currentUser
													}) => {

	const teamMembers = useMemo(() => {
		if (!head) return [];
		return [1, 2, 3]
			.map(i => ({
				index: i,
				name: head[`Znackar${i}`],
				int_adr: head[`INT_ADR_${i}`],
				isLeader: head[`Je_Vedouci${i}`] === "1"
			}))
			.filter(member => member.name?.trim());
	}, [head]);

	const sanitizeAttachments = (attachments: FileAttachment[]): FileAttachment[] => {
		if (!Array.isArray(attachments)) {
			return [];
		}
		
		const sanitized = attachments.map((att, index) => {
			if (!att || typeof att !== 'object') {
				return null;
			}
			
			const sanitizedAtt = {
				id: String(att.id || ''),
				fileName: String(att.fileName || ''),
				fileSize: Number(att.fileSize) || 0,
				fileType: String(att.fileType || ''),
				uploadedAt: att.uploadedAt instanceof Date ? att.uploadedAt : new Date(),
				uploadedBy: String(att.uploadedBy || ''),
				url: String(att.url || ''),
				thumbnailUrl: att.thumbnailUrl ? String(att.thumbnailUrl) : undefined,
				rotation: Number(att.rotation) || 0
			};
			
			return sanitizedAtt;
		}).filter(att => att !== null) as FileAttachment[];
		
		return sanitized;
	};

	// Total work hours calculation is now moved to CompensationSummary component


	const addTravelSegment = () => {
		const lastSegment = formData.travelSegments[formData.travelSegments.length - 1];
		const newSegment: TravelSegment = {
			id: crypto.randomUUID(),
			date: formData.executionDate,
			startTime: "08:00",
			endTime: "",
			startPlace: lastSegment?.endPlace || "",
			endPlace: "",
			transportType: "AUV",
			kilometers: 0,
			ticketCosts: 0,
			attachments: []
		};

		updateFormData({
			travelSegments: [...formData.travelSegments, newSegment]
		});
	};


	const updateSegmentField = (segmentId: string, updates: Partial<TravelSegment>) => {
		// Validace a sanitizace attachments
		if (updates.attachments) {
			updates = { ...updates, attachments: sanitizeAttachments(updates.attachments) };
		}
		
		updateFormData({
			travelSegments: formData.travelSegments.map(segment =>
				segment.id === segmentId
					? {...segment, ...updates}
					: segment
			)
		});
	};

	const duplicateSegment = (segmentId: string) => {
		const segment = formData.travelSegments.find(s => s.id === segmentId);
		if (!segment) return;

		const newSegment: TravelSegment = {
			...segment,
			id: crypto.randomUUID(),
			startPlace: segment.endPlace,
			endPlace: segment.startPlace,
			startTime: "",
			endTime: ""
		};

		updateFormData({
			travelSegments: [...formData.travelSegments, newSegment]
		});
	};

	const removeSegment = (segmentId: string) => {
		updateFormData({
			travelSegments: formData.travelSegments.filter(segment => segment.id !== segmentId)
		});
	};

	const moveSegmentUp = (segmentId: string) => {
		const segments = [...formData.travelSegments];
		const currentIndex = segments.findIndex(s => s.id === segmentId);

		if (currentIndex > 0) {
			// Swap with previous segment
			[segments[currentIndex - 1], segments[currentIndex]] = [segments[currentIndex], segments[currentIndex - 1]];
			updateFormData({travelSegments: segments});
		}
	};

	const moveSegmentDown = (segmentId: string) => {
		const segments = [...formData.travelSegments];
		const currentIndex = segments.findIndex(s => s.id === segmentId);

		if (currentIndex < segments.length - 1) {
			// Swap with next segment
			[segments[currentIndex], segments[currentIndex + 1]] = [segments[currentIndex + 1], segments[currentIndex]];
			updateFormData({travelSegments: segments});
		}
	};


	const addAccommodation = () => {
		const newAccommodation: Accommodation = {
			id: crypto.randomUUID(),
			place: "",
			facility: "",
			date: formData.executionDate,
			amount: 0,
			paidByMember: currentUser?.INT_ADR || teamMembers[0]?.int_adr || "",
			attachments: []
		};

		updateFormData({
			accommodations: [...formData.accommodations, newAccommodation]
		});
	};

	const updateAccommodation = (accommodationId: string, updates: Partial<Accommodation>) => {
		if (updates.attachments) {
			updates = { ...updates, attachments: sanitizeAttachments(updates.attachments) };
		}
		
		const newAccommodations = formData.accommodations.map(acc => {
			if (acc.id === accommodationId) {
				const updatedAcc = {...acc, ...updates};
				
				if (updatedAcc.attachments && !Array.isArray(updatedAcc.attachments)) {
					updatedAcc.attachments = [];
				}
				
				return updatedAcc;
			}
			return acc;
		});
		
		updateFormData({
			accommodations: newAccommodations
		});
	};

	const removeAccommodation = (accommodationId: string) => {
		updateFormData({
			accommodations: formData.accommodations.filter(acc => acc.id !== accommodationId)
		});
	};

	const addAdditionalExpense = () => {
		const newExpense: AdditionalExpense = {
			id: crypto.randomUUID(),
			description: "",
			date: formData.executionDate,
			amount: 0,
			paidByMember: currentUser?.INT_ADR || teamMembers[0]?.int_adr || "",
			attachments: []
		};

		updateFormData({
			additionalExpenses: [...formData.additionalExpenses, newExpense]
		});
	};

	const updateExpense = (expenseId: string, updates: Partial<AdditionalExpense>) => {
		if (updates.attachments) {
			updates = { ...updates, attachments: sanitizeAttachments(updates.attachments) };
		}
		
		const newExpenses = formData.additionalExpenses.map(exp => {
			if (exp.id === expenseId) {
				const updatedExp = {...exp, ...updates};
				
				if (updatedExp.attachments && !Array.isArray(updatedExp.attachments)) {
					updatedExp.attachments = [];
				}
				
				return updatedExp;
			}
			return exp;
		});
		
		updateFormData({
			additionalExpenses: newExpenses
		});
	};

	const removeExpense = (expenseId: string) => {
		updateFormData({
			additionalExpenses: formData.additionalExpenses.filter(exp => exp.id !== expenseId)
		});
	};

	const getTransportIcon = (type: string) => {
		const option = transportTypeOptions.find(opt => opt.value === type);
		return option ? option.icon : IconCar;
	};


	if (!canEdit) {
		return (
			<Alert icon={<IconInfoCircle size={16}/>} color="blue">
				Nemáte oprávnění upravovat toto hlášení.
			</Alert>
		);
	}

	return (
		<Stack gap="md">
			{/* Datum provedení */}
			<RenderErrorBoundary sectionName="Základní údaje">
			<Card shadow="sm" padding="md">

				<Title order={4} mb="md">Základní údaje</Title>
				<Grid>
					<Grid.Col span={{base: 12, sm: 6,}}>
						<DatePickerInput
							label="Datum provedení příkazu"
							placeholder="Vyberte datum"
							locale="cs"
							value={formData.executionDate}
							onChange={(date) => {
								if (date) {
									updateFormData({executionDate: date});
									// Aktualizuj datum u všech segmentů
									const updatedSegments = formData.travelSegments.map(segment => ({
										...segment,
										date
									}));
									updateFormData({travelSegments: updatedSegments});
								}
							}}
							required
							disabled={!canEdit}
							valueFormat="D. M. YYYY"
						/>
					</Grid.Col>
					<Grid.Col span={{base: 12, sm: 6,}}>
						{canEditOthers && (
							<Checkbox
								defaultChecked
								label="Kopírovat data na celou skupinu"
							/>
						)}
					</Grid.Col>
				</Grid>
			</Card>
			</RenderErrorBoundary>

			{/* Segmenty cesty */}
			<RenderErrorBoundary sectionName="Segmenty cesty">
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Segmenty cesty</Title>

				<Stack gap="md">
					{(formData.travelSegments || []).filter(seg => seg && seg.id).map((segment, index) => {
						if (!segment) return null;
						const TransportIcon = getTransportIcon(segment.transportType || "AUV");

						return (
							<>
								{index > 0 && (<Divider my="sm"/>)}
								<Box key={segment.id} ml="md" pl="lg" style={{borderLeft: "2px solid #4dabf7"}}
									 pos="relative">
									<Group
										pos="absolute"
										top="0"
										right="0"
										style={{zIndex: 10}}
										gap="xs"
									>
										{/* Přesunout nahoru - pouze pokud není první */}
										{index > 0 && (
											<ActionIcon
												variant="light"
												color="blue"
												onClick={() => moveSegmentUp(segment.id)}
												disabled={!canEdit}
												title="Přesunout nahoru"
											>
												<IconArrowUp size={14}/>
											</ActionIcon>
										)}

										{/* Přesunout dolů - pouze pokud není poslední */}
										{index < formData.travelSegments.length - 1 && (
											<ActionIcon
												variant="light"
												color="blue"
												onClick={() => moveSegmentDown(segment.id)}
												disabled={!canEdit}
												title="Přesunout dolů"
											>
												<IconArrowDown size={14}/>
											</ActionIcon>
										)}

										{/* Duplikovat segment */}
										<ActionIcon
											variant="light"
											color="green"
											onClick={() => duplicateSegment(segment.id)}
											disabled={!canEdit}
											title="Duplikovat cestu"
										>
											<IconCopy size={14}/>
										</ActionIcon>
										{formData.travelSegments.length > 1 && (
											<ActionIcon
												color="red"
												variant="light"
												onClick={() => removeSegment(segment.id)}
												disabled={!canEdit}
												title="Smazat cestu"
											>
												<IconTrash size={16}/>
											</ActionIcon>
										)}
									</Group>


									{/* Segment cesty */}
									<Box mb="md">
										<Group mb="md" pos="relative" wrap="wrap" align="start">
											<ThemeIcon radius="xl" size="lg" pos="absolute" left="-38px" top="-5px">
												<TransportIcon/>
											</ThemeIcon>
											<Box w="100px" pl="sm">
												<Text fw={500}>Cesta {index + 1}</Text>
											</Box>
											<Grid w={{base: "100%", xs: "auto"}} flex={{base: "auto", xs: "1"}}>
												<Grid.Col span={{base: 12, xs: 7,}}>
													<DatePickerInput
														locale="cs"
														value={segment.date || formData.executionDate}
														onChange={(date) => date && updateSegmentField(segment.id, {date})}
														disabled={!canEdit}
														valueFormat="D. M. YYYY"
													/>
												</Grid.Col>
												<Grid.Col span={{base: 12, xs: 5,}}>
												</Grid.Col>
											</Grid>
										</Group>

										<Group mb="md" pos="relative" wrap="wrap" align="start">
											<ThemeIcon pos="absolute" left="-32px" size="sm">
												<IconMapPin size={20}/>
											</ThemeIcon>
											<Box w="100px">
												<Text>Odjezd z</Text>
											</Box>
											<Grid flex={{base: "auto", sm: "1"}}>
												<Grid.Col span={{base: 12, sm: 7,}}>
													<TextInput
														placeholder="Místo"
														value={segment.startPlace || ""}
														onChange={(e) => updateSegmentField(segment.id, {startPlace: e.target.value})}
														disabled={!canEdit}
													/>
												</Grid.Col>
												<Grid.Col span={{base: 12, sm: 5,}}>
													<Group>
														<Text>V</Text>
														<TextInput
															flex="1"
															placeholder="HH:MM"
															value={segment.startTime || ""}
															onChange={(e) => updateSegmentField(segment.id, {startTime: e.target.value})}
															disabled={!canEdit}
															pattern="[0-9]{2}:[0-9]{2}"
														/>
													</Group>
												</Grid.Col>
											</Grid>
										</Group>

										<Group mb="md" pos="relative" wrap="wrap" align="start">
											<ThemeIcon pos="absolute" left="-32px" size="sm">
												<IconMapPin size={20}/>
											</ThemeIcon>
											<Box w="100px">
												<Text>Příjezd do</Text>
											</Box>
											<Grid flex={{base: "auto", sm: "1"}}>
												<Grid.Col span={{base: 12, sm: 7,}}>
													<TextInput
														placeholder="Místo"
														value={segment.endPlace || ""}
														onChange={(e) => updateSegmentField(segment.id, {endPlace: e.target.value})}
														disabled={!canEdit}
													/>
												</Grid.Col>
												<Grid.Col span={{base: 12, sm: 5,}}>
													<Group>
														<Text>V</Text>
														<TextInput
															flex="1"
															placeholder="HH:MM"
															value={segment.endTime || ""}
															onChange={(e) => updateSegmentField(segment.id, {endTime: e.target.value})}
															disabled={!canEdit}
															pattern="[0-9]{2}:[0-9]{2}"
														/>
													</Group>
												</Grid.Col>
											</Grid>
										</Group>

										<Grid my="sm">
											<Grid.Col span={{base: 12, sm: 6,}}>
												<Select
													label="Typ dopravy"
													data={transportTypeOptions.map(opt => ({
														value: opt.value,
														label: opt.label
													}))}
													value={segment.transportType || "AUV"}
													onChange={(value) => value && updateSegmentField(segment.id, {transportType: value as any})}
													disabled={!canEdit}
												/>
											</Grid.Col>
											<Grid.Col span={{base: 12, sm: 6,}}>
												{((segment.transportType || "AUV") === "AUV" || (segment.transportType || "") === "AUV-Z") ? (
													<NumberInput
														label="Kilometry"
														value={segment.kilometers || 0}
														onChange={(value) => updateSegmentField(segment.id, {kilometers: Number(value) || 0})}
														min={0}
														step={0.1}
														decimalScale={1}
														disabled={!canEdit}
													/>
												) : (
													<NumberInput
														label="Náklady na jízdenky (Kč)"
														value={segment.ticketCosts || 0}
														onChange={(value) => updateSegmentField(segment.id, {ticketCosts: Number(value) || 0})}
														min={0}
														step={0.01}
														decimalScale={2}
														disabled={!canEdit}
													/>
												)}
											</Grid.Col>
										</Grid>

										{(segment.transportType || "") === "veřejná doprava" && (
											<Box mt="sm">
												<Text size="sm" mb="xs">Jízdenky a doklady</Text>
												<RenderErrorBoundary sectionName={`FileUpload-Segment-${segment.id}`}>
												<FileUpload
													id={`segment-${segment.id}`}
													files={segment.attachments ?? []}
													onFilesChange={(files) => updateSegmentField(segment.id, {attachments: files})}
													maxFiles={10}
													accept="image/jpeg,image/png,image/heic,application/pdf"
													disabled={!canEdit}
												/>
												</RenderErrorBoundary>
											</Box>
										)}
									</Box>
								</Box>
							</>
						);
					})}

					{/* Tlačítko pro přidání na konci */}
					<Box mt="md" ta="center">
						<Button
							variant="outline"
							size="sm"
							leftSection={<IconPlus size={16}/>}
							onClick={addTravelSegment}
							disabled={!canEdit}
						>
							Přidat segment
						</Button>
					</Box>
				</Stack>
			</Card>
			</RenderErrorBoundary>

			{/* Nastavení řidiče */}
			<RenderErrorBoundary sectionName="Nastavení řidiče">
			{formData.travelSegments && formData.travelSegments.length > 0 && formData.travelSegments.some(s =>
				s && s.transportType && (s.transportType === "AUV" || s.transportType === "AUV-Z")
			) && (
				<Card shadow="sm" padding="md">
					<Title order={4} mb="md">Nastavení řidiče</Title>
					<Grid>
						<Grid.Col span={{base: 12, sm: 6,}}>
							<Select
								label="Primární řidič"
								placeholder="Vyberte řidiče"
								data={teamMembers.map(member => ({
									value: member.int_adr,
									label: `${member.name}${member.isLeader ? " (vedoucí)" : ""}`
								}))}
								value={formData.primaryDriver}
								onChange={(value) => value && updateFormData({primaryDriver: value})}
								required
								disabled={!canEdit}
							/>
						</Grid.Col>
						<Grid.Col span={{base: 12, sm: 6,}}>
							<TextInput
								label="Registrační značka"
								placeholder="např. 1A2 3456"
								value={formData.vehicleRegistration}
								onChange={(e) => updateFormData({vehicleRegistration: e.target.value})}
								required
								disabled={!canEdit}
							/>
						</Grid.Col>
					</Grid>
				</Card>
			)}
			</RenderErrorBoundary>

			{/* Nocležné */}
			<RenderErrorBoundary sectionName="Nocležné">
			{true && ( // RE-ENABLED FOR DEBUGGING
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Nocležné</Title>

				<Stack gap="md">
					{(formData.accommodations || []).filter(acc => acc && acc.id).map((accommodation, index) => (
						<>
							{index > 0 && (<Divider my="sm"/>)}
							<Box key={accommodation.id} pos="relative">
								<Group
									pos="absolute"
									top="0"
									right="0"
									style={{zIndex: 10}}
									gap="xs"
								>
									<ActionIcon
										color="red"
										variant="light"
										onClick={() => removeAccommodation(accommodation.id)}
										disabled={!canEdit}
										title="Smazat nocležné"
									>
										<IconTrash size={16}/>
									</ActionIcon>
								</Group>

								<Box mb="md">

									<Grid w={{base: "100%", xs: "auto"}} flex={{base: "auto", xs: "1"}} mr="40px">
										<Grid.Col span={{base: 12, sm: 6}}>
											<TextInput
												label="Místo"
												value={accommodation.place}
												onChange={(e) => updateAccommodation(accommodation.id, {place: e.target.value})}
												disabled={!canEdit}
											/>
										</Grid.Col>
										<Grid.Col span={{base: 12, sm: 6}}>
											<TextInput
												label="Zařízení"
												value={accommodation.facility}
												onChange={(e) => updateAccommodation(accommodation.id, {facility: e.target.value})}
												disabled={!canEdit}
											/>
										</Grid.Col>
									</Grid>

									<Grid my="sm">
										<Grid.Col span={{base: 12, sm: 4}}>
											<NumberInput
												label="Částka (Kč)"
												value={accommodation.amount}
												onChange={(value) => updateAccommodation(accommodation.id, {amount: Number(value) || 0})}
												min={0}
												step={0.01}
												decimalScale={2}
												disabled={!canEdit || (!canEditOthers && currentUser && accommodation.paidByMember !== currentUser.INT_ADR)}
											/>
										</Grid.Col>
										<Grid.Col span={{base: 12, sm: 4}}>
											<Select
												label="Uhradil"
												data={teamMembers.map(member => ({
													value: member.int_adr,
													label: member.name
												}))}
												value={accommodation.paidByMember}
												onChange={(value) => value && updateAccommodation(accommodation.id, {paidByMember: value})}
												disabled={!canEdit || (!canEditOthers && currentUser && accommodation.paidByMember !== currentUser.INT_ADR)}
											/>
											{currentUser && accommodation.paidByMember !== currentUser.INT_ADR && (
												<Text size="xs" c="dimmed" mt="xs">
													Započítává se do vyúčtování pro: {teamMembers.find(m => m.int_adr === accommodation.paidByMember)?.name}
												</Text>
											)}
										</Grid.Col>
										<Grid.Col span={{base: 12, sm: 4}}>
											<DatePickerInput
												label="Datum"
												locale="cs"
												value={accommodation.date}
												onChange={(date) => date && updateAccommodation(accommodation.id, {date})}
												disabled={!canEdit}
												valueFormat="D. M. YYYY"
											/>
										</Grid.Col>
									</Grid>

									<Box mt="sm">
										<Text size="sm" mb="xs">Doklady</Text>
										<RenderErrorBoundary sectionName={`FileUpload-Accommodation-${accommodation.id}`}>
										<FileUpload
											id={`accommodation-${accommodation.id}`}
											files={accommodation.attachments ?? []}
											onFilesChange={(files) => updateAccommodation(accommodation.id, {attachments: files})}
											maxFiles={5}
											accept="image/jpeg,image/png,image/heic,application/pdf"
											disabled={!canEdit || (!canEditOthers && currentUser && accommodation.paidByMember !== currentUser.INT_ADR)}
										/>
										</RenderErrorBoundary>
									</Box>
								</Box>
							</Box>
						</>
					))}

					{/* Tlačítko pro přidání na konci */}
					<Box mt="md" ta="center">
						<Button
							variant="outline"
							size="sm"
							leftSection={<IconPlus size={16}/>}
							onClick={addAccommodation}
							disabled={!canEdit}
						>
							Přidat nocležné
						</Button>
					</Box>
				</Stack>
			</Card>
			)}
			</RenderErrorBoundary>

			{/* Vedlejší výdaje */}
			<RenderErrorBoundary sectionName="Vedlejší výdaje">
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Vedlejší výdaje</Title>

				<Stack gap="md">
					{(formData.additionalExpenses || []).filter(exp => exp && exp.id).map((expense, index) => (
						<>
							{index > 0 && (<Divider my="sm"/>)}
							<Box key={expense.id}  pos="relative">
								<Group
									pos="absolute"
									top="0"
									right="0"
									style={{zIndex: 10}}
									gap="xs"
								>
									<ActionIcon
										color="red"
										variant="light"
										onClick={() => removeExpense(expense.id)}
										disabled={!canEdit}
										title="Smazat výdaj"
									>
										<IconTrash size={16}/>
									</ActionIcon>
								</Group>

								<Box mb="md">
									<Grid w={{base: "100%", xs: "auto"}} flex={{base: "auto", xs: "1"}} mr="40px">
										<Grid.Col span={12}>
											<TextInput
												label="Popis výdaje"
												value={expense.description}
												onChange={(e) => updateExpense(expense.id, {description: e.target.value})}
												disabled={!canEdit || (!canEditOthers && currentUser && expense.paidByMember !== currentUser.INT_ADR)}
											/>
										</Grid.Col>
									</Grid>

									<Grid my="sm">
										<Grid.Col span={{base: 12, sm: 4}}>
											<NumberInput
												label="Částka (Kč)"
												value={expense.amount}
												onChange={(value) => updateExpense(expense.id, {amount: Number(value) || 0})}
												min={0}
												step={0.01}
												decimalScale={2}
												disabled={!canEdit || (!canEditOthers && currentUser && expense.paidByMember !== currentUser.INT_ADR)}
											/>
										</Grid.Col>
										<Grid.Col span={{base: 12, sm: 4}}>
											<Select
												label="Uhradil"
												data={teamMembers.map(member => ({
													value: member.int_adr,
													label: member.name
												}))}
												value={expense.paidByMember}
												onChange={(value) => value && updateExpense(expense.id, {paidByMember: value})}
												disabled={!canEdit || (!canEditOthers && currentUser && expense.paidByMember !== currentUser.INT_ADR)}
											/>
											{currentUser && expense.paidByMember !== currentUser.INT_ADR && (
												<Text size="xs" c="dimmed" mt="xs">
													Započítává se do vyúčtování pro: {teamMembers.find(m => m.int_adr === expense.paidByMember)?.name}
												</Text>
											)}
										</Grid.Col>
										<Grid.Col span={{base: 12, sm: 4}}>
											<DatePickerInput
												label="Datum"
												locale="cs"
												value={expense.date}
												onChange={(date) => date && updateExpense(expense.id, {date})}
												disabled={!canEdit || (!canEditOthers && currentUser && expense.paidByMember !== currentUser.INT_ADR)}
												valueFormat="D. M. YYYY"
											/>
										</Grid.Col>
									</Grid>

									<Box mt="sm">
										<Text size="sm" mb="xs">Doklady</Text>
										<RenderErrorBoundary sectionName={`FileUpload-Expense-${expense.id}`}>
										<FileUpload
											id={`expense-${expense.id}`}
											files={expense.attachments ?? []}
											onFilesChange={(files) => updateExpense(expense.id, {attachments: files})}
											maxFiles={5}
											accept="image/jpeg,image/png,image/heic,application/pdf"
											disabled={!canEdit || (!canEditOthers && currentUser && expense.paidByMember !== currentUser.INT_ADR)}
										/>
										</RenderErrorBoundary>
									</Box>
								</Box>
							</Box>
						</>
					))}

					{/* Tlačítko pro přidání na konci */}
					<Box mt="md" ta="center">
						<Button
							variant="outline"
							size="sm"
							leftSection={<IconPlus size={16}/>}
							onClick={addAdditionalExpense}
							disabled={!canEdit}
						>
							Přidat výdaj
						</Button>
					</Box>
				</Stack>
			</Card>
			</RenderErrorBoundary>

			{/* Přesměrování výplat */}
			<RenderErrorBoundary sectionName="Přesměrování výplat">
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Přesměrování výplat</Title>
				<Text size="sm" c="dimmed" mb="md">
					Každý člen skupiny může nastavit, aby jeho kompenzace byla vyplacena jinému členovi skupiny.
				</Text>

				<Stack gap="sm">
					{teamMembers.map((member) => (
						<Group key={member.int_adr} justify="space-between">
							<Text>{member.name}</Text>
							<Select
								placeholder="Výplata pro..."
								data={[
									{value: "", label: "Sebe (výchozí)"},
									...teamMembers
										.filter(m => m.int_adr !== member.int_adr)
										.map(m => ({value: m.int_adr, label: m.name}))
								]}
								value={formData.paymentRedirects[member.int_adr]?.toString() || ""}
								onChange={(value) => {
									const newRedirects = {...formData.paymentRedirects};
									if (value) {
										newRedirects[member.int_adr] = parseInt(value);
									} else {
										delete newRedirects[member.int_adr];
									}
									updateFormData({paymentRedirects: newRedirects});
								}}
								w={200}
								disabled={!canEdit || (!canEditOthers && currentUser && member.int_adr !== currentUser.INT_ADR)}
							/>
						</Group>
					))}
				</Stack>
			</Card>
			</RenderErrorBoundary>
		</Stack>
	);
};