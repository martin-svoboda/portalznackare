import React from "react";
import {
	Stack,
	Group,
	Text,
	Badge, Divider
} from "@mantine/core";
import {IconCrown} from "@tabler/icons-react";
import {PrikazStavBadge} from "../PrikazStavBadge";
import {PrikazTypeIcon} from "../PrikazTypeIcon";
import {formatKm} from "@utils/formatting";

interface PrikazHeadProps {
	head: any;
	delka?: number | null;
	simple?: boolean;
}

const Member = ({name, isLeader}: { name: string; isLeader: boolean }) =>
	!name?.trim() ? null : (
		<Group gap="xs" align="center" wrap="nowrap">
			<Text span fw={isLeader ? 700 : 400}>
				{name}
			</Text>
			{isLeader && (
				<IconCrown color="#ffd700" size={18} aria-label="Vedoucí"/>
			)}
		</Group>
	);

export const PrikazHead: React.FC<PrikazHeadProps> = ({head, delka, simple = false}) => {
	// Pokud head není dostupný, vrátíme prázdný div
	if (!head) {
		return <div></div>;
	}

	return (
		<Stack gap="md">
			<Group gap="xl" align="start" wrap="wrap">
				<Stack gap="sm">
					<PrikazTypeIcon
						type={head.Druh_ZP}
						size={66}
					/>
				</Stack>
				<Stack gap="xs">
					<Text c="dimmed" fz="sm">{head.Druh_ZP_Naz}</Text>
					{delka &&
						<Text size="sm">Dékla: <b>{formatKm(delka)} Km</b></Text>
					}
					{!simple && <PrikazStavBadge stav={head.Stav_ZP_Naz}/>}
				</Stack>
				{!simple && (
					<Stack gap="sm">
						<Text size="sm">KKZ: <b>{head.Nazev_KKZ}</b></Text>
						<Text size="sm">ZO: <b>{head.Nazev_ZO}</b></Text>
					</Stack>
				)}
				<Stack gap="sm">
					{[1, 2, 3].map(i =>
						<Member
							key={i}
							name={head[`Znackar${i}`]}
							isLeader={head[`Je_Vedouci${i}`] === "1"}
						/>
					)}
				</Stack>
				<Stack gap="xs">
					<Text size="sm">Předpokládané trvání cesty: <b>{head.Doba}</b> den/dnů</Text>
					<Text size="sm">pro <b>{head.Pocet_clenu}</b> člennou skupinu</Text>
					{head.ZvysenaSazba === "1" && <Badge color="yellow" mt={4}>Zvýšená sazba</Badge>}
				</Stack>
			</Group>
			{!simple && head.Poznamka_ZP && (
				<>
					<Divider my="xs"/>
					<Stack gap="xs">
						<Text fw={700} fz="md">Popis činnosti</Text>
						<Text style={{whiteSpace: "pre-line"}}>
							{head.Poznamka_ZP}
						</Text>
					</Stack>
				</>
			)}
		</Stack>
	);
};