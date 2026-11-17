import { defineEnvVars } from '@sveltejs/kit/env';

// Variabel ini wajib ada di .env — aplikasi tidak akan jalan tanpanya.
export const variables = defineEnvVars({
	RESEND_API_KEY: {},
	RESEND_TO: {}
});
