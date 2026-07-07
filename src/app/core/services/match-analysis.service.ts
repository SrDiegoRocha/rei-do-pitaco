import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IMatchAnalysisResponse } from '@core/interfaces/match-analysis.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class MatchAnalysisService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  /**
   * Retrospecto da partida: forma recente de cada time (últimos jogos),
   * contexto posicional (tabela/grupo/fase anterior) e confrontos diretos no
   * torneio. Agrega tudo o que a aba "Retrospecto" precisa em uma chamada.
   */
  public get(
    tournamentId: string,
    matchId: string,
  ): Observable<IMatchAnalysisResponse> {
    return this._http.get<IMatchAnalysisResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches/${matchId}/analysis`,
    );
  }
}
