import {
	IconSquare,
	IconSquareArrowRight,
	IconEdit,
	IconCheckbox,
	IconCopyCheck,
	IconCash, IconHammer, IconBrush, IconTool, IconSignLeft,
} from '@tabler/icons-react';
import {Badge, ThemeIcon} from '@mantine/core';
import { barvaDleKodu} from "@utils/colors";

type PrikazTypeIconProps = {
	type: string;
	size?: number;
};

const druhZPIkona: Record<string, any> = {
	O: IconBrush,      // Obnova – štětec
	N: IconTool,       // Nová – nářadí
	S: IconSignLeft,   // Směrovky/rozcestníky – směrovka
};

export function PrikazTypeIcon({
								   type,
								   size = 28
							   }: PrikazTypeIconProps) {
	const IconComponent = druhZPIkona[type] || IconHammer; // Default: kladivo

	return (
		<ThemeIcon
			color={barvaDleKodu("KH")}
			variant="outline"
			style={{
				width: `${size}px`,
				height: `${size}px`,
				background: "white"
			}}
		>
			<IconComponent style={{width: '80%', height: '80%'}}/>
		</ThemeIcon>
	);
}