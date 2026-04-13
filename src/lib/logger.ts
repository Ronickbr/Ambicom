
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class DebugLogger {
  private static instance: DebugLogger;
  private logs: Array<{ timestamp: string; level: LogLevel; message: string; data?: any }> = [];

  private constructor() { }

  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private formatMessage(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // console.log intentionally removed per user request for performance and cleanliness
    if (level === 'error') {
      console.error(`[${timestamp}] [ERROR] ${message}`, data);
    }
  }

  public info(message: string, data?: any) {
    this.formatMessage('info', message, data);
  }

  public warn(message: string, data?: any) {
    this.formatMessage('warn', message, data);
  }

  public error(message: string, data?: any) {
    this.formatMessage('error', message, data);
  }

  public debug(message: string, data?: any) {
    this.formatMessage('debug', message, data);
  }

  public getLogs() {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
  }
}

export const logger = DebugLogger.getInstance();
