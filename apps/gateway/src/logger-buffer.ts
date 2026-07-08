import { prisma } from 'db';

interface ApiLogInput {
  endpointId: string;
  method: string;
  path: string;
  reqHeaders: any;
  reqQuery: any;
  reqBody: any;
  resHeaders: any;
  resStatus: number;
  resBody: string | null;
  duration: number;
}

class LoggerBuffer {
  private queue: ApiLogInput[] = [];
  private flushInterval = 3000; // Flush logs every 3 seconds
  private maxBatchSize = 100; // Flush immediately if queue grows past 100
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.startInterval();
  }

  private startInterval() {
    this.intervalId = setInterval(() => this.flush(), this.flushInterval);
  }

  public logRequest(logData: ApiLogInput) {
    this.queue.push(logData);

    if (this.queue.length >= this.maxBatchSize) {
      // Flush immediately if buffer is full
      this.flush();
    }
  }

  public async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = []; // Clear queue immediately to avoid double insertion

    try {
      await prisma.apiLog.createMany({
        data: batch.map((log) => ({
          endpointId: log.endpointId,
          method: log.method,
          path: log.path,
          reqHeaders: log.reqHeaders || {},
          reqQuery: log.reqQuery || {},
          reqBody: log.reqBody,
          resHeaders: log.resHeaders || {},
          resStatus: log.resStatus,
          resBody: log.resBody,
          duration: log.duration,
        })),
      });
      console.log(`[LOG-BUFFER] Flushed ${batch.length} logs to database`);
    } catch (error) {
      console.error('[LOG-BUFFER] Error flushing request logs to database:', error);
      // Restore logs to queue to retry later if database was down
      this.queue = [...batch, ...this.queue];
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export const loggerBuffer = new LoggerBuffer();
