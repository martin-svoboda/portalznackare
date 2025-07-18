import {
	IconSquare,
	IconSquareArrowRight,
	IconEdit,
	IconCheckbox,
	IconCopyCheck,
	IconCash,
} from '@tabler/icons-react';
import { Badge } from '@mantine/core';

const stavMap = {
	'Nové':        { icon: IconSquare, color: 'gray' },
	'Vystavený':   { icon: IconSquareArrowRight, color: 'indigo' },
	'Přidělený':   { icon: IconEdit, color: 'blue'},
	'Provedený':   { icon: IconCheckbox, color: 'teal' },
	'Předaný KKZ': { icon: IconCopyCheck, color: 'green' },
	'Zaúčtovaný':  { icon: IconCash, color: 'lime' },
};

export function PrikazStavBadge({ stav }: { stav: string }) {
	const conf = stavMap[stav as keyof typeof stavMap] || { icon: IconSquare, color: 'gray' };
	const Icon = conf.icon;

	return (
		<Badge
			leftSection={<Icon size={14} style={{ marginRight: 2 }} />}
			color={conf.color}
			size="lg"
			radius="sm"
			variant="light"
			style={{ textTransform: 'none' }}
			title={stav}
		>
			{stav}
		</Badge>
	);
}