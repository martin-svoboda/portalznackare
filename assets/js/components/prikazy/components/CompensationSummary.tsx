import React, {useMemo} from "react";
import {
	Stack,
	Card,
	Title,
	Group,
	Text,
	Table,
	Badge,
	Divider,
	Alert,
	Box,
	Grid,
	NumberFormatter
} from "@mantine/core";
import {
	IconCalculator,
	IconCar,
	IconClock,
	IconBed,
	IconReceipt,
	IconArrowRight,
	IconInfoCircle
} from "@tabler/icons-react";
import {HlaseniFormData, CompensationCalculation, PriceList} from "../types/HlaseniTypes";
import {calculateCompensation, calculateWorkHours, calculateCompensationForAllMembers} from "../utils/compensationCalculator";
import {formatCurrency} from "@utils/formatting";

interface CompensationSummaryProps {
	formData: HlaseniFormData;
	priceList: PriceList | null;
	head: any;
	totalLength?: number | null;
	compact?: boolean;
	currentUser?: any; // Aktuální přihlášený uživatel
	isLeader?: boolean; // Zda je aktuální uživatel vedoucí
}

export const CompensationSummary: React.FC<CompensationSummaryProps> = ({
	formData,
	priceList,
	head,
	totalLength,
	compact = false,
	currentUser,
	isLeader = false
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

	// Použití nového kálkulátoru pracovních hodin
	const workHours = useMemo(() => {
		return calculateWorkHours(formData);
	}, [formData]);

	// Výpočet kompenzací - buď pro aktuálního uživatele nebo pro všechny členy
	const compensations = useMemo(() => {
		if (!priceList || !currentUser) {
			return {};
		}

		if (isLeader) {
			// Vedoucí vidí všechny členy
			return calculateCompensationForAllMembers(
				formData,
				priceList,
				teamMembers,
				formData.primaryDriver,
				formData.higherKmRate
			);
		} else {
			// Běžný člen vidí pouze sebe
			const isDriver = formData.primaryDriver === currentUser.INT_ADR;
			const userCompensation = calculateCompensation(
				formData,
				priceList,
				isDriver,
				formData.higherKmRate,
				currentUser.INT_ADR
			);
			return { [currentUser.INT_ADR]: userCompensation };
		}
	}, [formData, priceList, currentUser, isLeader, teamMembers]);

	// Pro zpětnou kompatibilitu - hlavní kompenzace aktuálního uživatele
	const compensation = compensations[currentUser?.INT_ADR] || {
		transportCosts: 0,
		mealAllowance: 0,
		workAllowance: 0,
		accommodationCosts: 0,
		additionalExpenses: 0,
		total: 0,
		workHours: 0,
		appliedTariff: null,
		isDriver: false
	};


	if (!priceList) {
		return (
			<Alert icon={<IconInfoCircle size={16} />} color="blue">
				Načítání ceníku pro výpočet kompenzací...
			</Alert>
		);
	}

	// Compact mode - pouze základní souhrn s detaily
	if (compact) {
		return (
			<Stack gap="sm">
				<Group justify="space-between">
					<Text size="sm" fw={500}>Práce celkem</Text>
					<Text size="sm">{workHours.toFixed(1)} h</Text>
				</Group>

				<Stack gap="0">
					<Group justify="space-between">
						<Text size="sm" fw={500}>
							Jízdné
							{priceList && compensation.isDriver && (
								<Text span size="xs" c="dimmed" ml="xs">
									({formData.higherKmRate ? priceList.jizdneZvysene : priceList.jizdne} Kč/km)
								</Text>
							)}
						</Text>
						<Text size="sm">{formatCurrency(compensation.transportCosts)}</Text>
					</Group>
					{/* Detaily dopravních nákladů */}
					{formData.travelSegments.map((segment, index) => {
						if (!segment || !segment.transportType) return null;

						let detail = "";
						if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
							if (compensation.isDriver && segment.kilometers > 0) {
								detail = `${segment.startPlace} - ${segment.endPlace}: ${segment.kilometers} km`;
							} else if (!compensation.isDriver) {
								detail = `${segment.startPlace} - ${segment.endPlace}: Nejste řidič`;
							}
						} else if (segment.transportType === "veřejná doprava" && segment.ticketCosts > 0) {
							detail = `${segment.startPlace} - ${segment.endPlace}: Jízdenky ${formatCurrency(segment.ticketCosts)}`;
						}

						if (detail) {
							return (
								<Text key={segment.id} size="xs" c="dimmed" ml="md">
									{detail}
								</Text>
							);
						}
						return null;
					})}
				</Stack>

				<Stack gap="0">
					<Group justify="space-between">
						<Text size="sm" fw={500}>Stravné</Text>
						<Text size="sm">{formatCurrency(compensation.mealAllowance)}</Text>
					</Group>
					{compensation.appliedTariff && (
						<Text size="xs" c="dimmed" ml="md">
							Tarif za {compensation.appliedTariff.dobaOd}-{compensation.appliedTariff.dobaDo}h práce
						</Text>
					)}
				</Stack>

				<Stack gap="0">
					<Group justify="space-between">
						<Text size="sm" fw={500}>Náhrada za práci</Text>
						<Text size="sm">{formatCurrency(compensation.workAllowance)}</Text>
					</Group>
					{compensation.appliedTariff && (
						<Text size="xs" c="dimmed" ml="md">
							Tarif za {compensation.appliedTariff.dobaOd}-{compensation.appliedTariff.dobaDo}h práce
						</Text>
					)}
				</Stack>

				{compensation.accommodationCosts > 0 && (
					<Stack gap="0">
						<Group justify="space-between">
							<Text size="sm" fw={500}>Ubytování</Text>
							<Text size="sm">{formatCurrency(compensation.accommodationCosts)}</Text>
						</Group>
						{/* Detaily ubytování - pouze ty co uhradil aktuální uživatel */}
						{formData.accommodations
							.filter(acc => currentUser && acc.paidByMember === currentUser.INT_ADR)
							.map(acc => (
								<Text key={acc.id} size="xs" c="dimmed" ml="md">
									{acc.facility}, {acc.place}: {formatCurrency(acc.amount)}
								</Text>
							))
						}
					</Stack>
				)}

				{compensation.additionalExpenses > 0 && (
					<Stack gap="0">
						<Group justify="space-between">
							<Text size="sm" fw={500}>Ostatní výdaje</Text>
							<Text size="sm">{formatCurrency(compensation.additionalExpenses)}</Text>
						</Group>
						{/* Detaily vedlejších výdajů - pouze ty co uhradil aktuální uživatel */}
						{formData.additionalExpenses
							.filter(exp => currentUser && exp.paidByMember === currentUser.INT_ADR)
							.map(exp => (
								<Text key={exp.id} size="xs" c="dimmed" ml="md">
									{exp.description}: {formatCurrency(exp.amount)}
								</Text>
							))
						}
					</Stack>
				)}

				<Divider />
				<Group justify="space-between">
					<Text fw={600}>Celkem k vyplacení</Text>
					<Text fw={600} size="lg" c="blue">
						{formatCurrency(compensation.total)}
					</Text>
				</Group>

			</Stack>
		);
	}

	// Plný mode
	return (
		<Stack gap="md">
			{/* Přehled práce */}
			<Card shadow="sm" padding="md">
				<Group justify="space-between" mb="md">
					<Title order={4}>Přehled práce</Title>
					<Badge variant="light" leftSection={<IconClock size={14} />}>
						{workHours.toFixed(1)} hodin
					</Badge>
				</Group>

				<Grid>
					<Grid.Col span={6}>
						<Text size="sm" c="dimmed">Celková doba práce</Text>
						<Text fw={500}>{workHours.toFixed(1)} hodin</Text>
						<Text size="xs" c="dimmed" mt="xs">
							Od nejdřívějšího začátku do nejpozdějšího konce cesty
						</Text>
					</Grid.Col>
					<Grid.Col span={6}>
						<Text size="sm" c="dimmed">Použitý tarif</Text>
						<Text fw={500}>
							{compensation.appliedTariff
								? `${compensation.appliedTariff.dobaOd}-${compensation.appliedTariff.dobaDo}h`
								: "Není stanoven"}
						</Text>
					</Grid.Col>
				</Grid>

				{totalLength && (
					<Box mt="md">
						<Text size="sm" c="dimmed">Délka úseku k obnově</Text>
						<Text fw={500}>{(totalLength / 1000).toFixed(1)} km</Text>
					</Box>
				)}
			</Card>

			{/* Pokud je vedoucí, zobraz výpočty pro všechny členy */}
			{isLeader && Object.keys(compensations).length > 1 && (
				<Card shadow="sm" padding="md">
					<Title order={4} mb="md">Souhrn náhrad podle členů</Title>
					<Stack gap="md">
						{teamMembers.map(member => {
							const memberCompensation = compensations[member.int_adr];
							if (!memberCompensation) return null;

							return (
								<Box key={member.int_adr} p="sm" style={{border: "1px solid #e9ecef", borderRadius: "4px"}}>
									<Group justify="space-between" mb="xs">
										<Text fw={500}>{member.name}</Text>
										<Text fw={600} c="blue">{formatCurrency(memberCompensation.total)}</Text>
									</Group>
									<Grid gutter="xs">
										<Grid.Col span={6}>
											<Text size="xs" c="dimmed">Doprava: {formatCurrency(memberCompensation.transportCosts)}</Text>
										</Grid.Col>
										<Grid.Col span={6}>
											<Text size="xs" c="dimmed">Stravné: {formatCurrency(memberCompensation.mealAllowance)}</Text>
										</Grid.Col>
										<Grid.Col span={6}>
											<Text size="xs" c="dimmed">Práce: {formatCurrency(memberCompensation.workAllowance)}</Text>
										</Grid.Col>
										<Grid.Col span={6}>
											<Text size="xs" c="dimmed">Ostatní: {formatCurrency(memberCompensation.accommodationCosts + memberCompensation.additionalExpenses)}</Text>
										</Grid.Col>
									</Grid>
								</Box>
							);
						})}
					</Stack>
				</Card>
			)}

			{/* Dopravní náklady */}
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Dopravní náklady</Title>

				<Table>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Segment</Table.Th>
							<Table.Th>Typ dopravy</Table.Th>
							<Table.Th>Množství</Table.Th>
							<Table.Th>Sazba</Table.Th>
							<Table.Th>Náklady</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{formData.travelSegments.map((segment, index) => {
							if (!segment || !segment.transportType) return null;

							let amount = 0;
							let unit = "";
							let rate = 0;
							let costs = 0;

							if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
								amount = segment.kilometers || 0;
								unit = "km";
								rate = formData.higherKmRate ? priceList.jizdneZvysene : priceList.jizdne;
								costs = compensation.isDriver ? amount * rate : 0;
							} else if (segment.transportType === "veřejná doprava") {
								costs = segment.ticketCosts || 0;
								unit = "Kč";
							}

							return (
								<Table.Tr key={segment.id}>
									<Table.Td>Segment {index + 1}</Table.Td>
									<Table.Td>
										<Badge variant="light" size="sm" color="blue">
											{segment.transportType}
										</Badge>
									</Table.Td>
									<Table.Td>
										{amount > 0 ? `${amount} ${unit}` : "-"}
									</Table.Td>
									<Table.Td>
										{rate > 0 ? formatCurrency(rate) : "-"}
									</Table.Td>
									<Table.Td fw={500}>
										{formatCurrency(costs)}
									</Table.Td>
								</Table.Tr>
							);
						})}
					</Table.Tbody>
				</Table>
			</Card>

			{/* Ostatní náklady */}
			{(formData.accommodations.length > 0 || formData.additionalExpenses.length > 0) && (
				<Card shadow="sm" padding="md">
					<Title order={4} mb="md">Ostatní náklady</Title>

					{formData.accommodations.length > 0 && (
						<Box mb="md">
							<Group gap="xs" mb="xs">
								<IconBed size={16} />
								<Text fw={500}>Nocležné</Text>
							</Group>
							{formData.accommodations.map(acc => {
								const paidByMember = teamMembers.find(m => m.int_adr === acc.paidByMember);
								const isCurrentUserExpense = currentUser && acc.paidByMember === currentUser.INT_ADR;

								return (
									<Box key={acc.id} mb="xs">
										<Group justify="space-between">
											<Text size="sm">
												{acc.facility}, {acc.place} - {paidByMember?.name}
											</Text>
											<Text fw={500}>{formatCurrency(acc.amount)}</Text>
										</Group>
										{!isCurrentUserExpense && (
											<Text size="xs" c="dimmed" fs="italic">
												Započítává se do vyúčtování pro: {paidByMember?.name}
											</Text>
										)}
									</Box>
								);
							})}
						</Box>
					)}

					{formData.additionalExpenses.length > 0 && (
						<Box>
							<Group gap="xs" mb="xs">
								<IconReceipt size={16} />
								<Text fw={500}>Vedlejší výdaje</Text>
							</Group>
							{formData.additionalExpenses.map(exp => {
								const paidByMember = teamMembers.find(m => m.int_adr === exp.paidByMember);
								const isCurrentUserExpense = currentUser && exp.paidByMember === currentUser.INT_ADR;

								return (
									<Box key={exp.id} mb="xs">
										<Group justify="space-between">
											<Text size="sm">
												{exp.description} - {paidByMember?.name}
											</Text>
											<Text fw={500}>{formatCurrency(exp.amount)}</Text>
										</Group>
										{!isCurrentUserExpense && (
											<Text size="xs" c="dimmed" fs="italic">
												Započítává se do vyúčtování pro: {paidByMember?.name}
											</Text>
										)}
									</Box>
								);
							})}
						</Box>
					)}
				</Card>
			)}

			{/* Celkový souhrn */}
			<Card shadow="sm" padding="md">
				<Title order={4} mb="md">Celkový souhrn kompenzací</Title>

				<Stack gap="xs">
					<Group justify="space-between">
						<Text>Dopravní náklady</Text>
						<Text fw={500}>{formatCurrency(compensation.transportCosts)}</Text>
					</Group>
					<Group justify="space-between">
						<Text>Stravné</Text>
						<Text fw={500}>{formatCurrency(compensation.mealAllowance)}</Text>
					</Group>
					<Group justify="space-between">
						<Text>Náhrada za práci</Text>
						<Text fw={500}>{formatCurrency(compensation.workAllowance)}</Text>
					</Group>
					<Group justify="space-between">
						<Text>Nocležné</Text>
						<Text fw={500}>{formatCurrency(compensation.accommodationCosts)}</Text>
					</Group>
					<Group justify="space-between">
						<Text>Vedlejší výdaje</Text>
						<Text fw={500}>{formatCurrency(compensation.additionalExpenses)}</Text>
					</Group>
					<Divider />
					<Group justify="space-between">
						<Text fw={700} size="lg">Celkem</Text>
						<Text fw={700} size="lg">{formatCurrency(compensation.total)}</Text>
					</Group>
				</Stack>
			</Card>

			{/* This section was removed as it's already replaced above */}

		</Stack>
	);
};