import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from '@core/http/query-params';
import {
  IPendingPredictionsCountResponse,
  IUserMatchListParams,
  IUserMatchResponse,
} from '@core/interfaces/user-match.interface';
import { API_BASE_URL } from '@core/services/api-config';

/**
 * Feed pessoal de partidas — a tela inicial do app.
 *
 * Lista as partidas (com horário marcado) de todos os torneios em que o usuário
 * é membro ativo, já ordenadas cronologicamente pelo backend. Aceita janela de
 * data (`from`/`to`/`limit`) para paginar por rede.
 */
@Injectable({ providedIn: 'root' })
export class UserMatchesService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  /**
   * Lista o feed. Sem params, devolve tudo (`scheduledAt` ASC). Com
   * `from`/`to`/`limit`, recorta a janela `[from, to)` para paginação.
   */
  public list(
    params?: IUserMatchListParams,
  ): Observable<IUserMatchResponse[]> {
    return this._http.get<IUserMatchResponse[]>(
      `${this._baseUrl}/api/users/me/matches`,
      { params: toHttpParams(params ?? null) },
    );
  }

  /** Quantos jogos estão esperando o pitaco do usuário (badge da tela inicial). */
  public pendingCount(): Observable<IPendingPredictionsCountResponse> {
    return this._http.get<IPendingPredictionsCountResponse>(
      `${this._baseUrl}/api/users/me/matches/pending-count`,
    );
  }
}
