import { prisma } from 'db';

export function startLogPruner() {
  console.log('[LOG-PRUNER] Starting log pruning background task (runs every 24h)');

  async function pruneLogs() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.apiLog.deleteMany({
        where: {
          timestamp: {
            lt: sevenDaysAgo,
          },
        },
      });
      console.log(`[LOG-PRUNER] Cleaned up ${result.count} stale request logs older than 7 days`);
    } catch (error) {
      console.error('[LOG-PRUNER] Error pruning request logs:', error);
    }
  }

  // Run immediately on boot
  pruneLogs();

  // Run every 24 hours
  setInterval(pruneLogs, 24 * 60 * 60 * 1000);
}
