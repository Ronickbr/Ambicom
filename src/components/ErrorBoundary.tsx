
import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/logger";
import { parseError } from "@/lib/errors";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Uncaught Error in ErrorBoundary:", { error, errorInfo });
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const parsedError = this.state.error ? parseError(this.state.error) : null;

      return (
        <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-4 max-w-2xl text-center">
            <ShieldAlert className="w-16 h-16 text-destructive" />
            <h1 className="text-3xl font-bold tracking-tight">Ocorreu um erro inesperado</h1>
            <p className="text-muted-foreground">
              {parsedError?.message || "Nossa equipe já foi notificada. Tente recarregar a página."}
            </p>
          </div>

          {this.state.error && (
            <div className="bg-muted p-4 rounded-lg max-w-2xl w-full overflow-auto border border-border">
              <p className="font-mono text-sm text-destructive font-semibold mb-2">
                {this.state.error.toString()}
              </p>
              <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack?.trim()}
              </pre>
            </div>
          )}

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-md hover:bg-secondary/80 transition-colors"
            >
              <Home className="w-4 h-4" />
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
