
import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { X, RefreshCw, Trash2, Copy } from 'lucide-react';

export function DebugPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState(logger.getLogs());

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        
        const interval = setInterval(() => {
            if (isOpen) {
                setLogs([...logger.getLogs()]);
            }
        }, 1000);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
            clearInterval(interval);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-card border border-border/20 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-border/20 bg-background/20">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"/>
                        System Debugger
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setLogs([...logger.getLogs()])}
                            className="p-2 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={() => {
                                logger.clearLogs();
                                setLogs([]);
                            }}
                            className="p-2 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            title="Clear"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={() => {
                                const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message} ${JSON.stringify(l.data || '')}`).join('\n');
                                navigator.clipboard.writeText(text);
                            }}
                            className="p-2 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy to Clipboard"
                        >
                            <Copy className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-1 bg-black">
                    {logs.length === 0 ? (
                        <div className="text-muted-foreground text-center py-10">No logs recorded yet.</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="flex gap-2 hover:bg-foreground/5 p-1 rounded">
                                <span className="text-muted-foreground shrink-0 w-32">{log.timestamp.split('T')[1].split('.')[0]}</span>
                                <span className={`font-bold shrink-0 w-16 ${
                                    log.level === 'error' ? 'text-red-500' :
                                    log.level === 'warn' ? 'text-yellow-500' :
                                    log.level === 'info' ? 'text-blue-500' :
                                    'text-gray-500'
                                }`}>
                                    {log.level.toUpperCase()}
                                </span>
                                <span className="text-gray-300 break-all">
                                    {log.message}
                                    {log.data && (
                                        <span className="text-gray-500 ml-2">
                                            {JSON.stringify(log.data)}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
