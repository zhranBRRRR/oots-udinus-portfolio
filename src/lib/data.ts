export type Project = {
	title: string;
	description: string;
	stack: string;
	year: number;
};

export const projects: Project[] = [
	{
		title: 'Sistem Absensi Kelas',
		description: 'Aplikasi pencatatan kehadiran siswa dengan rekap otomatis per bulan.',
		stack: 'SvelteKit',
		year: 2026
	},
	{
		title: 'Landing Page UKM',
		description: 'Halaman profil organisasi sekolah dengan formulir pendaftaran anggota.',
		stack: 'Tailwind',
		year: 2026
	},
	{
		title: 'Dashboard Jaringan',
		description: 'Pemantauan status perangkat lab sekolah secara real-time.',
		stack: 'TypeScript',
		year: 2026
	},
	{
		title: "Snapan Hihu",
		description: "SAYA CINTA KANTIN KUNING",
		stack: "pulstek",
		year: 2026
	}
];
