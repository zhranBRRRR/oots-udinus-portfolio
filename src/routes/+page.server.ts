import { fail } from '@sveltejs/kit';
import { RESEND_API_KEY, RESEND_TO } from '$app/env/private';
import type { Actions } from './$types';

export const actions = {
	kirim: async ({ request }) => {
		const data = await request.formData();

		const nama = String(data.get('nama') ?? '').trim();
		const email = String(data.get('email') ?? '').trim();
		const pesan = String(data.get('pesan') ?? '').trim();

		if (!nama || !email || !pesan) {
			return fail(400, { pesan: 'Semua kolom harus diisi.' });
		}

		if (!email.includes('@')) {
			return fail(400, { pesan: 'Format email belum benar.' });
		}

		const kunci = RESEND_API_KEY;
		const tujuan = RESEND_TO;

		if (!kunci || !tujuan) {
			return fail(500, { pesan: 'Kunci Resend belum dipasang di .env.' });
		}

		const balasan = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${kunci}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				// Resend hanya mengizinkan pengirim ini selama domain kalian
				// belum diverifikasi.
				from: 'Portofolio <onboarding@resend.dev>',
				to: [tujuan],
				reply_to: email,
				subject: `Pesan dari ${nama}`,
				text: `${pesan}\n\n— ${nama} <${email}>`
			})
		});

		if (!balasan.ok) {
			console.error('Resend menolak:', balasan.status, await balasan.text());
			return fail(502, { pesan: 'Gagal mengirim. Coba lagi.' });
		}

		return { sukses: true };
	}
} satisfies Actions;
