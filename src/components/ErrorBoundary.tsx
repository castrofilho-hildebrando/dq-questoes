import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
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

  private isBenignLockError = (value: unknown): boolean => {
    const message = value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : String(value ?? "");

    const normalized = message.toLowerCase();

    return (
      normalized.includes("lockmanager") ||
      normalized.includes("navigator.locks") ||
      normalized.includes("lock broken") ||
      normalized.includes("lock was stolen") ||
      normalized.includes("lock request is aborted") ||
      normalized.includes("steal' option") ||
      normalized.includes('steal" option')
    );
  };

  private unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);

    // Web Locks race/collision errors are benign browser-level conditions
    // and should not crash the UI.
    if (this.isBenignLockError(message)) {
      console.warn("Ignoring benign lock error:", message);
      event.preventDefault();
      return;
    }

    console.error("Unhandled promise rejection:", event.reason);
    this.setState({
      hasError: true,
      error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    });
    event.preventDefault();
  };

  private errorHandler = (event: ErrorEvent) => {
    // ResizeObserver loop errors are benign browser warnings - ignore them
    if (event.message?.includes("ResizeObserver loop")) {
      event.preventDefault();
      return;
    }

    // Web Locks race/collision errors are benign - ignore them too
    if (this.isBenignLockError(event.message)) {
      console.warn("Ignoring benign lock error:", event.message);
      event.preventDefault();
      return;
    }

    console.error("Global error:", event.error);
    this.setState({
      hasError: true,
      error: event.error instanceof Error ? event.error : new Error(event.message),
    });
    event.preventDefault();
  };

  public componentDidMount() {
    // Capture unhandled promise rejections
    window.addEventListener("unhandledrejection", this.unhandledRejectionHandler);
    // Capture global errors
    window.addEventListener("error", this.errorHandler);
  }

  public componentWillUnmount() {
    window.removeEventListener("unhandledrejection", this.unhandledRejectionHandler);
    window.removeEventListener("error", this.errorHandler);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleClearCache = () => {
    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }
    window.location.href = "/auth";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>Ops! Algo deu errado</CardTitle>
              <CardDescription>
                Ocorreu um erro inesperado. Por favor, tente uma das opções abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <p className="font-medium text-destructive mb-1">Detalhes do erro:</p>
                  <p className="text-muted-foreground break-words">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Button onClick={this.handleReload} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recarregar Página
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                    <Home className="w-4 h-4 mr-2" />
                    Ir para Início
                  </Button>
                  <Button variant="destructive" onClick={this.handleClearCache} className="flex-1">
                    Limpar Cache
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Se o problema persistir, tente limpar o cache ou usar uma aba anônima.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
