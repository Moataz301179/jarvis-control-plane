export function installProcessGuards(name) {
  process.on('unhandledRejection', (reason) => {
    console.error(`[${name}] unhandled rejection; exiting for supervisor restart:`, reason);
    process.exit(1);
  });
  process.on('uncaughtException', (error) => {
    console.error(`[${name}] uncaught exception; exiting for supervisor restart:`, error);
    process.exit(1);
  });
}
