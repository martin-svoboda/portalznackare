import {useAuth} from "./AuthContext";
import React from "react";
import {
	Group,
	Flex,
	Avatar, Menu, Text, useMantineTheme
} from "@mantine/core";
import {useNavigate} from "react-router-dom";
import {IconChecklist, IconHome2, IconLogout, IconUser} from "@tabler/icons-react";

const UserWidget = () => {
	const {user} = useAuth();
	const navigate = useNavigate();

	const isActive = (path: string) => location.pathname === path;

	const name = `${user?.Jmeno} ${user?.Prijmeni}`;

	return (
		<Group gap="xs">
			<Avatar
				color="blue"
				key={name}
				name={name}
			/>
			<Flex style={{flex: 1}} visibleFrom="md" direction="column">
				<Text size="sm" fw={500} component="strong">
					{user?.Jmeno} {user?.Prijmeni}
				</Text>
				<Text c="dimmed" size="xs">
					{user?.Prukaz_znackare || 'Značkař'}
				</Text>
			</Flex>
		</Group>
	);
};

export default UserWidget;