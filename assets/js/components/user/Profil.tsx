import React from "react";
import {Card, Group, Text, Stack, Badge, Title, Divider, Container} from "@mantine/core";
import {useAuth} from "@components/auth/AuthContext";
import {Helmet} from "react-helmet-async";
import RequireLogin from "@components/auth/RequireLogin";

const fieldLabels: Record<string, string> = {
	Jmeno: "Jméno",
	Prijmeni: "Příjmení",
	Titul_Pred: "Titul před",
	Titul_Za: "Titul za",
	INT_ADR: "Identifikační číslo uživatele (INT_ADR)",
	Kraj: "Kraj",
	Kod_KKZ: "Kód kraje",
	Obvod: "Obvod",
	Kod_Obvod: "Kód obvodu",
	Ulice_cp: "Ulice a č.p.",
	Misto: "Místo",
	PSC: "PSČ",
	Clen_KCT: "Člen KČT",
	Cislo_Clena: "Číslo člena",
	Telefon_zakladni: "Telefon",
	Telefon_alternativni: "Alternativní telefon",
	eMail: "E-mail",
	Datum_narozeni: "Datum narození",
	Bankovni_Ucet: "Bankovní účet",
	Banka: "Kód banky",
	Vedouci_dvojice: "Vedoucí dvojice",
	Dvojice_jmeno: "Dvojice – jméno",
	Prukaz_znackare: "Průkaz značkaře",
	Plati_Do: "Platí do",
};

const Profil = () => {
	const {user, loggedIn} = useAuth();
	const blogName = 'Portál značkaře';

	return (
		<RequireLogin>
			<Helmet>
				<title>Profil { user ? `${user?.Jmeno} ${user?.Prijmeni}` : 'uživatele' } | {blogName}</title>
			</Helmet>

			<Container size="lg" px={0} my="md">

				<Title order={2} mb="md">
					Profil uživatele
				</Title>

				<Card shadow="sm" padding="lg" radius="md" withBorder>
					{user ?
						<Stack gap="xs">
							<Group>
								<Text fw={700}>{user.Jmeno} {user.Prijmeni}</Text>
								{user.Titul_Pred && <Badge color="blue">{user.Titul_Pred}</Badge>}
								{user.Titul_Za && <Badge color="blue">{user.Titul_Za}</Badge>}
							</Group>
							<Divider mb="xs"/>
							<Text><b>Kraj:</b> {user.Kraj} ({user.Kod_KKZ})</Text>
							<Text><b>Obvod:</b> {user.Obvod} ({user.Kod_Obvod})</Text>
							<Text><b>Adresa:</b> {user.Ulice_cp}, {user.Misto}, {user.PSC}</Text>
							<Text><b>Telefon:</b> {user.Telefon_zakladni}</Text>
							{user.Telefon_alternativni && (
								<Text><b>Alternativní telefon:</b> {user.Telefon_alternativni}</Text>
							)}
							<Text><b>E-mail:</b> {user.eMail}</Text>
							<Text><b>Datum narození:</b> {user.Datum_narozeni}</Text>
							<Text><b>Člen KČT:</b> {user.Clen_KCT === "1" ? "Ano" : "Ne"}</Text>
							{user.Cislo_Clena && (
								<Text><b>Číslo člena:</b> {user.Cislo_Clena}</Text>
							)}
							<Text><b>Průkaz značkaře:</b> {user.Prukaz_znackare}</Text>
							{user.Plat_Do && <Text><b>Platnost průkazu do:</b> {user.Plat_Do}</Text>}
							{user.Dvojice_jmeno && (
								<>
									<Text><b>Dvojice:</b> {user.Dvojice_jmeno}</Text>
									<Text><b>Vedoucí
										dvojice:</b> {user.Vedouci_dvojice === "1" ? "Ano" : "Ne"} </Text>
								</>
							)}
							{user.Bankovni_Ucet && (
								<Text><b>Bankovní účet:</b> {user.Bankovni_Ucet}/{user.Banka}</Text>
							)}
						</Stack>
						:
						<Text>Data profilu nejsou k dispozici.</Text>
					}

				</Card>
			</Container>
		</RequireLogin>
	);
};

export default Profil;