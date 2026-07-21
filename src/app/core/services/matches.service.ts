import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from '@core/http/query-params';
import {
  ICreateMatchRequest,
  IMatchListParams,
  IMatchLocationResponse,
  IMatchResponse,
  ISetMatchResultRequest,
  IUpdateMatchRequest,
} from '@core/interfaces/match.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class MatchesService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  public list(
    tournamentId: string,
    phaseId: string,
    params?: IMatchListParams,
  ): Observable<IMatchResponse[]> {
    return this._http.get<IMatchResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches`,
      { params: toHttpParams(params ?? null) },
    );
  }

  public listForTournament(
    tournamentId: string,
  ): Observable<IMatchResponse[]> {
    return this._http.get<IMatchResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches`,
    );
  }

  /**
   * Pernas de um confronto pelo `tieId`, ordenadas por `round` ASC (ida antes
   * da volta). 1 partida em jogo único; 2 em ida-e-volta. Nível torneio (sem
   * phase). `tieId` de outro torneio devolve `[]`.
   */
  public listByTie(
    tournamentId: string,
    tieId: string,
  ): Observable<IMatchResponse[]> {
    return this._http.get<IMatchResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches/tie/${tieId}`,
    );
  }

  public getById(
    tournamentId: string,
    phaseId: string,
    matchId: string,
  ): Observable<IMatchResponse> {
    return this._http.get<IMatchResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches/${matchId}`,
    );
  }

  /**
   * Resolve um link curto (/m/:matchId) para a localização completa da partida
   * (torneio + fase), usado pelo MatchLocatorComponent.
   */
  public locate(matchId: string): Observable<IMatchLocationResponse> {
    return this._http.get<IMatchLocationResponse>(
      `${this._baseUrl}/api/matches/${matchId}/location`,
    );
  }

  public create(
    tournamentId: string,
    phaseId: string,
    payload: ICreateMatchRequest,
  ): Observable<IMatchResponse> {
    return this._http.post<IMatchResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches`,
      payload,
    );
  }

  public update(
    tournamentId: string,
    phaseId: string,
    matchId: string,
    payload: IUpdateMatchRequest,
  ): Observable<IMatchResponse> {
    return this._http.put<IMatchResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches/${matchId}`,
      payload,
    );
  }

  public setResult(
    tournamentId: string,
    phaseId: string,
    matchId: string,
    payload: ISetMatchResultRequest,
  ): Observable<IMatchResponse> {
    return this._http.put<IMatchResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches/${matchId}/result`,
      payload,
    );
  }

  public cancel(
    tournamentId: string,
    phaseId: string,
    matchId: string,
  ): Observable<IMatchResponse> {
    return this._http.put<IMatchResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches/${matchId}/cancel`,
      {},
    );
  }

  public remove(
    tournamentId: string,
    phaseId: string,
    matchId: string,
  ): Observable<void> {
    return this._http.delete<void>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches/${matchId}`,
    );
  }

  public generate(
    tournamentId: string,
    phaseId: string,
  ): Observable<IMatchResponse[]> {
    return this._http.post<IMatchResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/matches/generate`,
      {},
    );
  }
}
