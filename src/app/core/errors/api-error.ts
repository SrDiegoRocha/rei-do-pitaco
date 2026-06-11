import { HttpErrorResponse } from '@angular/common/http';
import {
  IApiError,
  IFieldError,
} from '@core/interfaces/api.interface';

export class ApiException extends Error {
  public readonly status: number;
  public readonly apiError: IApiError | null;
  public readonly fieldErrors: IFieldError[];
  public override readonly cause: HttpErrorResponse;

  constructor(response: HttpErrorResponse) {
    const apiError = isApiError(response.error) ? response.error : null;
    const message =
      apiError?.message ?? response.message ?? `HTTP ${response.status}`;
    super(message);
    this.name = 'ApiException';
    this.status = response.status;
    this.apiError = apiError;
    this.fieldErrors = apiError?.fieldErrors ?? [];
    this.cause = response;
  }

  public get isValidationError(): boolean {
    return this.status === 400;
  }

  public get isUnauthorized(): boolean {
    return this.status === 401;
  }

  public get isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * Falha de autenticação: token ausente, expirado ou inválido. Neste backend
   * um token expirado volta como 403, por isso 401 e 403 entram aqui — em ambos
   * os casos tentar novamente não resolve; o usuário precisa logar de novo.
   */
  public get isAuthError(): boolean {
    return this.isUnauthorized || this.isForbidden;
  }

  public get isNotFound(): boolean {
    return this.status === 404;
  }

  public get isConflict(): boolean {
    return this.status === 409;
  }

  public fieldError(field: string): string | null {
    return this.fieldErrors.find((f) => f.field === field)?.message ?? null;
  }
}

/**
 * Sessão expirada / sem autenticação válida (401 ou 403). Centraliza a regra
 * usada pela UI para decidir quando oferecer o botão de login.
 */
export function isSessionExpiredError(err: unknown): boolean {
  return err instanceof ApiException && err.isAuthError;
}

function isApiError(value: unknown): value is IApiError {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['status'] === 'number' &&
    typeof obj['message'] === 'string' &&
    typeof obj['path'] === 'string'
  );
}
