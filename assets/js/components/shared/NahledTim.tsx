import React, {useRef, useLayoutEffect, useState} from "react";
import {Paper, Flex, Group, Text, Box, Stack} from "@mantine/core";
import {formatKm} from "@utils/formatting";
import {TimArrowShape} from "./TimArrowShape";
import {barvaDleKodu} from "@utils/colors";
import {replaceTextWithIcons} from "./textIconReplacer";

function getItemLines(item: any) {
	return [1, 2, 3]
		.map(i => {
			const text = item[`Radek${i}`]?.trim();
			const km = item[`KM${i}`] && Number(item[`KM${i}`]) > 0 ? formatKm(item[`KM${i}`]) : null;
			return text ? {text, km} : null;
		})
		.filter(Boolean);
}

const NahledTim = ({item}: { item: any }) => {
	const lines = getItemLines(item);
	const showArrow =
		item.Druh_Predmetu === "S" || item.Druh_Predmetu === "D";
	const direction = item.Smerovani;

	const [height, setHeight] = useState<number>(60); // Default výška
	const paperRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (paperRef.current) {
			setHeight(paperRef.current.offsetHeight);
		}
	}, [lines]);

	const vedouciBarva = item.Barva_Kod ? barvaDleKodu(item.Barva_Kod) : 'transparent';

	const barvaPodkladu = (val: string | undefined) => {
		if (!val) return "orange.0";
		const v = val.trim().toUpperCase();
		switch (v) {
			case "PZT":
				return "orange.0";
			case "LZT":
				return "orange.5";
			case "CZT":
			case "CZS":
				return "yellow.4";
			default:
				return "orange.0";
		}
	}


	let itemStyle: { padding: string; clipPath?: string } = {
		padding: "5px"
	}
	let shapeStyle: {} = {
		display: "none",
	}
	if (showArrow && direction === "L") {
		itemStyle = {
			padding: "5px 5px 5px 50px",
			clipPath: "polygon(45px 0, 100% 0, 100% 100%, 45px 100%, 0px 50%)"
		}
		shapeStyle = {
			left: "0",
			transform: "translateY(-50%)",
			justifyContent: "end",
		}
	}
	if (showArrow && direction === "P") {
		itemStyle = {
			padding: "5px 50px 5px 5px",
			clipPath: "polygon(calc(100% - 45px) 0, 100% 50%, calc(100% - 45px) 100%, 0 100%, 0 0)"
		}
		shapeStyle = {
			right: "0",
			transform: "translateY(-50%)",
			justifyContent: "start",
		}
	}

	return (
		<Flex align="center" gap={0}>
			<Paper
				ref={paperRef}
				shadow="xs"
				style={itemStyle}
				withBorder
				bg={barvaPodkladu(item.Druh_Presunu)}
				pos="relative"
			>
				{showArrow && direction && <Box
					pos="absolute"
					top="50%"
					w="40px"
					h="25px"
					display="flex"
					style={shapeStyle}
				>
					<TimArrowShape color={vedouciBarva} shape={item.Druh_Odbocky_Kod || item.Druh_Znaceni_Kod}/>
				</Box>}
				<Stack gap={0}>
					<Flex
						w="210"
						mih="60"
						gap={0}
						justify="center"
						align="center"
						direction="column"
					>
						{lines.length > 0 ? (
							lines.map((line, idx) => {
								// Konstanty pro scale transformaci
								const longTextThreshold = 20;
								const scaleCompressed = 0.75;
								const scaleNormal = 0.85;
								const currentScale = line?.text?.length > longTextThreshold ? scaleCompressed : scaleNormal;
								const textSize = item.Druh_Predmetu === "M" ? idx === 0 ? "lg" : "xs" : "sm";

								// Společná funkce pro renderování textu
								const renderTextContent = ( hideIcon = false) => {
									if (!line?.text) return null;
									return line.text.split(/(\([^)]*\))/).flatMap((part: string, i: number) => {
										if (part.startsWith('(') && part.endsWith(')')) {
											return <small key={i}>{part}</small>;
										}
										// Použij novou globální funkci pro nahrazení ikon
										return <span key={i}>{replaceTextWithIcons(part, 10, hideIcon)}</span>;
									});
								};

								return (
									<Group
										key={idx}
										justify={line?.km ? "space-between" : "center"}
										w="100%"
										mih={16}
										gap={0}
										pos="relative"
									>
										{line?.km ? (
											<>
												<Box style={{
													display: 'flex',
													justifyContent: 'flex-start',
													flex: 1,
												}}>
													<Box pos="absolute" top="0" w='120%'>
														<Text fw={700} size={textSize} c="black"
															  style={{
																  transform: `scaleX(${currentScale})`,
																  whiteSpace: 'nowrap',
																  transformOrigin: 'left center'
															  }}
														>
															{renderTextContent()}
														</Text>
													</Box>
												</Box>
												<Text size={textSize} c="black">{line?.km} km</Text>
											</>
										) : item.Druh_Predmetu === "M" && idx === 0 ? (
											<Box pos="absolute" bottom="-7px" w='120%'>
												<Text ta="center" fw={700} size={textSize} c="black"
													  style={{
														  transform: `scaleX(${scaleCompressed})`,
														  transformOrigin: 'center'
													  }}
												>
													{renderTextContent(true)}
												</Text>
											</Box>
										) : (
											<Text ta="center" fw={700} size={textSize} c="black"
												  style={{
													  transform: `scaleX(${scaleNormal})`,
													  transformOrigin: 'center'
												  }}
											>
												{renderTextContent()}
											</Text>
										)}
									</Group>
								);
							})
						) : (
							<Text size="sm" c="dimmed" ta="center">Žádný popis</Text>
						)}
					</Flex>
					<Group
						justify="space-between"
						w="100%"
						gap={0}
						mih={16}
					>
						<Text ta="center" size="xs" c="black">{item.Rok_Vyroby}</Text>
						<Text ta="right" size="xs" c="black">{item.EvCi_TIM + item.Predmet_Index}</Text>
					</Group>
				</Stack>
			</Paper>
		</Flex>
	);
};

export default NahledTim;