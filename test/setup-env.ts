// CI has no config/.env, and AuthModule refuses to start without JWT_SECRET.
// Runs in every e2e worker before the specs load.
process.env.JWT_SECRET ??= 'x'.repeat(32);
process.env.TELEGRAM_BOT_USERNAME ??= 'PsyDom_Tbilisi_Test_bot';
process.env.APPLICATION_MESSAGING_ENABLED ??= 'true';
