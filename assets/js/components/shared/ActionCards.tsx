import {Card, Group, SimpleGrid, Text, useMantineColorScheme} from "@mantine/core";
import {useNavigate} from "react-router-dom";
import React from "react";
import type {Icon} from "@tabler/icons-react";

type ActionCardItem = {
	title: string;
	path: string;
	icon: Icon;
};

type ActionCardsProps = {
	cards: ActionCardItem[];
};

const ActionCards = ({cards}: ActionCardsProps) => {
	const navigate = useNavigate();
	const {colorScheme} = useMantineColorScheme();
	const isDark = colorScheme === "dark";

	return (
		<>
			<style>{`
				.action-card:hover {
					background-color: ${isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-1)'} !important;
				}
			`}</style>
			<SimpleGrid cols={{base: 2, sm: 3, lg: 4}} mt="md">
			{cards.map((item) => (
				<Card
					key={item.title}
					shadow="sm"
					padding="xl"
					component="a"
					role="link"
					aria-label={`Přejít na ${item.title}`}
					className="action-card"
					style={{cursor: "pointer"}}
					onClick={() => navigate(item.path)}
				>
					<Group>
						<item.icon size={24} stroke={1.2}/>
						<Text size="lg" fw={500}>
							{item.title}
						</Text>
					</Group>
				</Card>
			))}
		</SimpleGrid>
		</>
	);
};

export default ActionCards;