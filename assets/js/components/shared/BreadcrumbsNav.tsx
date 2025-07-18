import React from "react";
import { Group, Button } from "@mantine/core";
import { useNavigate } from "react-router-dom";

type Crumb = { title: string; href: string };

export const BreadcrumbsNav: React.FC<{ items: Crumb[] }> = ({ items }) => {
	const navigate = useNavigate();
	return (
		<Group gap="xs" mb="sm">
			{items.map((item, idx) => (
				<>
				<Button
					key={item.href}
					variant="subtle"
					color="blue"
					p="xs"
					onClick={() => navigate(item.href)}
				>
					{item.title}
				</Button> /
				</>
			))}
		</Group>
	);
};