import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  IPlacePredictionRequest,
  IPredictionResponse,
  IPredictionStatsResponse,
  IRecalculationResponse,
} from '@core/interfaces/prediction.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class PredictionsService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  public upsertMine(
    tournamentId: string,
    matchId: string,
    payload: IPlacePredictionRequest,
  ): Observable<IPredictionResponse> {
    return this._http.put<IPredictionResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches/${matchId}/predictions/me`,
      payload,
    );
  }

  public removeMine(
    tournamentId: string,
    matchId: string,
  ): Observable<void> {
    return this._http.delete<void>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches/${matchId}/predictions/me`,
    );
  }

  public stats(
    tournamentId: string,
    matchId: string,
  ): Observable<IPredictionStatsResponse> {
    return this._http.get<IPredictionStatsResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches/${matchId}/predictions/stats`,
    );
  }

  public listForMatch(
    tournamentId: string,
    matchId: string,
  ): Observable<IPredictionResponse[]> {
    return this._http.get<IPredictionResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/matches/${matchId}/predictions`,
    );
  }

  public listMineInTournament(
    tournamentId: string,
  ): Observable<IPredictionResponse[]> {
    return this._http.get<IPredictionResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/predictions/me`,
    );
  }

  /**
   * Reaplica a pontuação vigente do torneio a todos os palpites já existentes,
   * inclusive das partidas que já acabaram. Owner-only. Sem body.
   */
  public recalculatePoints(
    tournamentId: string,
  ): Observable<IRecalculationResponse> {
    return this._http.post<IRecalculationResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/predictions/recalculate`,
      {},
    );
  }

  /** Pitacos de um participante específico no torneio (sujeito à redação). */
  public listForUserInTournament(
    tournamentId: string,
    userId: string,
  ): Observable<IPredictionResponse[]> {
    return this._http.get<IPredictionResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/predictions`,
      { params: { userId } },
    );
  }
}
