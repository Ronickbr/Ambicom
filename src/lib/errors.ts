import { toast } from "sonner";
import { logger } from "./logger";
import { PostgrestError } from "@supabase/supabase-js";

export class AppError extends Error {
    public code?: string;
    public details?: unknown;
    public isOperational: boolean;

    constructor(message: string, code?: string, details?: unknown, isOperational = true) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
    }
}

/**
 * Parses an unknown error and returns a user-friendly message
 * and a standardized AppError object.
 */
export function parseError(error: unknown, fallbackMessage = "Ocorreu um erro inesperado."): AppError {
    if (error instanceof AppError) {
        return error;
    }

    // Handle Supabase/Postgrest errors
    if (typeof error === "object" && error !== null) {
        const pgError = error as PostgrestError;
        if (pgError.code && pgError.message) {
            // Map common Supabase/Postgrest error codes
            let msg = pgError.message;
            if (pgError.code === "23505") msg = "Este registro já existe.";
            if (pgError.code === "23503") msg = "Este registro está em uso e não pode ser alterado.";
            if (pgError.code === "42P01") msg = "Tabela não encontrada no banco de dados.";
            if (pgError.code === "PGRST301") msg = "Autenticação necessária para acessar este recurso.";
            if (pgError.code === "PGRST116") msg = "Registro não encontrado.";

            return new AppError(msg, pgError.code, pgError, true);
        }
    }

    if (error instanceof Error) {
        // Network errors
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
            return new AppError("Sem conexão com a internet. Verifique sua rede e tente novamente.", "NETWORK_ERROR", error, true);
        }
        return new AppError(error.message, "UNKNOWN_ERROR", error, true);
    }

    if (typeof error === "string") {
        return new AppError(error, "STRING_ERROR", error, true);
    }

    return new AppError(fallbackMessage, "UNKNOWN_ERROR", error, false);
}

/**
 * Main error handler function.
 * Use this in try/catch blocks across the application.
 */
export function handleError(error: unknown, customMessage?: string) {
    const parsedError = parseError(error, customMessage);

    // Log the error centrally
    if (parsedError.isOperational) {
        logger.error(`[Operational Error]: ${parsedError.message}`, { details: parsedError.details, code: parsedError.code });
    } else {
        logger.error(`[Unhandled/System Error]: ${parsedError.message}`, { details: parsedError.details, error });
    }

    // Display user-friendly notification
    toast.error(customMessage ? `${customMessage}: ${parsedError.message}` : parsedError.message);
}

/**
 * Initializes global error listeners for uncaught exceptions and unhandled promises.
 * Should be called once at application startup.
 */
export function initGlobalErrorHandling() {
    if (typeof window === "undefined") return;

    window.addEventListener("unhandledrejection", (event) => {
        // Prevent default console.error if needed
        // event.preventDefault();
        logger.error("Unhandled Promise Rejection", { reason: event.reason });
        const err = parseError(event.reason);
        toast.error(`Erro inesperado em segundo plano: ${err.message}`);
    });

    window.addEventListener("error", (event) => {
        // event.preventDefault();
        logger.error("Uncaught Global Error", { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error });
        // We let ErrorBoundary handle the UI part if it happens during React render,
        // but this ensures we catch errors outside of React (e.g. DOM event handlers).
    });
}
