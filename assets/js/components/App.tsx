import React, {useMemo} from 'react';
import {
	AppShell,
	Burger,
	Group,
	Text,
	useMantineTheme,
	Button, useMantineColorScheme, ActionIcon, NavLink, Divider,
} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {Routes, Route, useNavigate, Link, useLocation} from 'react-router-dom';
import { useAuth } from '@components/auth/AuthContext';
import UserWidget from '@components/auth/UserWidget';
import Dashboard from '@components/user/Dashboard';
import Profil from '@components/user/Profil';
import Prikazy from '@components/prikazy/Prikazy';
import Prikaz from '@components/prikazy/Prikaz';
import HlaseniPrikazu from '@components/prikazy/HlaseniPrikazu';
import {
	IconBooks,
	IconChecklist,
	IconDownload, IconFileDescription, IconHome2,
	IconLayoutDashboard, IconLogout,
	IconMoon,
	IconSun,
	IconUser
} from "@tabler/icons-react";

const staticNavItems = [
	{path: "/metodika", label: "Metodika", icon: IconBooks},
	{path: "/downloads", label: "Ke stažení", icon: IconDownload},
];

const staticUserNavItems = [
	{path: "/nastenka", label: "Moje nástěnka", icon: IconLayoutDashboard},
	{path: "/prikazy", label: "Příkazy", icon: IconChecklist},
	{path: "/profil", label: "Profil", icon: IconUser},
];

const ColorSchemeToggle = () => {
	const {colorScheme, toggleColorScheme} = useMantineColorScheme();
	const isDark = colorScheme === "dark";

	return (
		<ActionIcon
			variant="subtle"
			size="lg"
			aria-label="Přepnout motiv světlý/tmavý"
			onClick={toggleColorScheme}
			title="Přepnout motiv"
		>
			{isDark ? <IconSun size={24} stroke={1.2}/> : <IconMoon size={24} stroke={1.2}/>}
		</ActionIcon>
	);
};

const App: React.FC = () => {
	const [opened, {toggle}] = useDisclosure();
	const theme = useMantineTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const { loggedIn, logout } = useAuth();

	const isActive = (path: string) => location.pathname === path;

	const menuItems = useMemo(() => {
		const symfonyMenu: any[] = []; // TODO: fetch from API
		const customItems = symfonyMenu.map((item) => ({
			path: item.url?.replace(window.location.origin, ""),
			label: item.title,
			icon: IconFileDescription,
		}));
		return [...customItems, ...staticNavItems];
	}, []);

	const NavLinkItem = ({item}: {item: {path: string; label: string; icon?: any}}) => {
		return (
			<NavLink
				active={isActive(item.path)}
				label={item.label}
				onClick={() => {
					navigate(item.path);
					if (window.innerWidth < 992) toggle();
				}}
				leftSection={item.icon ? <item.icon size={20} stroke={1.2}/> :
					<IconFileDescription size={20} stroke={1.2}/>}
				aria-label={`Přejít na ${item.label}`}
			/>
		);
	}

	return (
		<AppShell
			header={{height: 60}}
			navbar={{width: 220, breakpoint: 'md', collapsed: {mobile: !opened}}}
			padding="md"
		>
			<AppShell.Header withBorder={false}>
				<Group h="100%" px="md" justify="space-between" align="center">
					<Group>
						<Burger
							opened={opened}
							onClick={toggle}
							size="sm"
							aria-label={opened ? "Zavřít menu" : "Otevřít menu"}
							title={opened ? "Zavřít menu" : "Otevřít menu"}
							hiddenFrom="md"
						/>
						<Text 
							size="lg" 
							fw={700} 
							style={{cursor: 'pointer'}}
							onClick={() => navigate('/')}
						>
							Portál značkaře
						</Text>
					</Group>
					<Group>
						<ColorSchemeToggle/>
						{loggedIn ? (
							<UserWidget/>
						) : (
							<Button
								color="blue"
								onClick={() => {
									navigate("/nastenka");
								}}
							>Přihlásit se</Button>
						)}
					</Group>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md" withBorder={false}>
				<NavLinkItem item={{path: "/", label: "Úvod", icon: IconHome2}}/>
				{menuItems.map((item) => (
					<NavLinkItem key={item.path} item={item}/>
				))}
				<Divider/>
				{loggedIn &&
					<>
						{staticUserNavItems.map((item) => (
							<NavLinkItem key={item.path} item={item}/>
						))}
						<Divider/>
						<NavLink
							label="Odhlásit se"
							onClick={() => {
								logout();
								if (window.innerWidth < 992) toggle();
							}}
							leftSection={<IconLogout size={20} stroke={1.2}/>}
							style={{color: theme.colors.red[6]}}
							aria-label="Odhlásit se"
						/>
					</>
				}
			</AppShell.Navbar>

			<AppShell.Main>
				<Routes>
					<Route path="/" element={
						<div>
							<Text size="xl" fw={700} mb="md">Vítejte v Portálu značkaře!</Text>
							<Text>Toto je úvodní stránka aplikace.</Text>
						</div>
					} />
					<Route path="/nastenka" element={<Dashboard />} />
					<Route path="/profil" element={<Profil />} />
					<Route path="/prikazy" element={<Prikazy />}/>
					<Route path="/prikaz/:id" element={<Prikaz />}/>
					<Route path="/prikaz/:id/hlaseni" element={<HlaseniPrikazu />}/>
					<Route path="/downloads" element={<Text size="xl">TODO Downloads</Text>}/>
					<Route path="*" element={
						<div>
							<Text size="xl" fw={700} mb="md">Stránka nenalezena</Text>
							<Text>Požadovaná stránka neexistuje nebo není ještě doplněna.</Text>
						</div>
					} />
				</Routes>
			</AppShell.Main>
		</AppShell>
	);
};

export default App;