export type Project = {
	title: string;
	description: string;
	stack: string;
	year: number;
	/** Opsional: tautan demo/repo, kosong kalau proyek belum punya */
	link?: string;
};

export const projects: Project[] = [
	{
		title: 'WordlEffect',
		description: 'Game Wordle dengan efek terinspirasi dari Tetris Effect',
		stack: 'React',
		year: 2026
	},
	{
		title: 'packet_',
		description: 'Aplikasi P2P untuk berbagi files dan text di network yang sama dengan cepat',
		stack: 'React dan PeerJS',
		year: 2026
	},
	{
		title: 'OpenLily',
		description: 'Aplikasi scanning disk untuk macOS berbentuk bunga',
		stack: 'SwiftUI',
		year: 2026
	},
];
