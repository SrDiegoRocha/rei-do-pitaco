import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IPage } from '@core/interfaces/api.interface';
import {
  IParticipantSummaryResponse,
  IPendingPickemResponse,
  IPhasePredictionResponse,
  IPhasePredictionStatsResponse,
  IPhasePredictionTemplateResponse,
  IPickemRecalculationResponse,
  IPlacePhasePredictionRequest,
} from '@core/interfaces/pickem.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class PickemService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  private _phaseUrl(tournamentId: string, phaseId: string): string {
    return `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/pickem`;
  }

  /** Molde da tela (estado da janela, pontuação e estrutura a preencher). */
  public template(
    tournamentId: string,
    phaseId: string,
  ): Observable<IPhasePredictionTemplateResponse> {
    return this._http.get<IPhasePredictionTemplateResponse>(
      `${this._phaseUrl(tournamentId, phaseId)}/template`,
    );
  }

  /** Upsert do meu Pick'em (cria ou substitui por inteiro). */
  public upsertMine(
    tournamentId: string,
    phaseId: string,
    payload: IPlacePhasePredictionRequest,
  ): Observable<IPhasePredictionResponse> {
    return this._http.put<IPhasePredictionResponse>(
      `${this._phaseUrl(tournamentId, phaseId)}/me`,
      payload,
    );
  }

  /** Meu Pick'em na fase (404 se ainda não palpitei). */
  public getMine(
    tournamentId: string,
    phaseId: string,
  ): Observable<IPhasePredictionResponse> {
    return this._http.get<IPhasePredictionResponse>(
      `${this._phaseUrl(tournamentId, phaseId)}/me`,
    );
  }

  /** Remove meu Pick'em (só com a janela aberta). */
  public removeMine(tournamentId: string, phaseId: string): Observable<void> {
    return this._http.delete<void>(
      `${this._phaseUrl(tournamentId, phaseId)}/me`,
    );
  }

  /** Pick'ems de todos os participantes — sempre visíveis, points desc. */
  public list(
    tournamentId: string,
    phaseId: string,
    page = 0,
    size = 20,
  ): Observable<IPage<IPhasePredictionResponse>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));
    return this._http.get<IPage<IPhasePredictionResponse>>(
      this._phaseUrl(tournamentId, phaseId),
      { params },
    );
  }

  /** Pick'em de um participante específico (404 se não palpitou). */
  public getForUser(
    tournamentId: string,
    phaseId: string,
    userId: string,
  ): Observable<IPhasePredictionResponse> {
    return this._http.get<IPhasePredictionResponse>(
      `${this._phaseUrl(tournamentId, phaseId)}/${userId}`,
    );
  }

  /** Previsão da galera da fase (só agregados, nunca palpites individuais). */
  public stats(
    tournamentId: string,
    phaseId: string,
  ): Observable<IPhasePredictionStatsResponse> {
    return this._http.get<IPhasePredictionStatsResponse>(
      `${this._phaseUrl(tournamentId, phaseId)}/stats`,
    );
  }

  /** Owner: repontua todos os Pick'ems da fase contra o estado real atual. */
  public recalculate(
    tournamentId: string,
    phaseId: string,
  ): Observable<IPickemRecalculationResponse> {
    return this._http.post<IPickemRecalculationResponse>(
      `${this._phaseUrl(tournamentId, phaseId)}/recalculate`,
      {},
    );
  }

  /** Perfil do palpiteiro: breakdown partidas × Pick'em por fase/componente. */
  public participantSummary(
    tournamentId: string,
    userId: string,
  ): Observable<IParticipantSummaryResponse> {
    return this._http.get<IParticipantSummaryResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/participants/${userId}/summary`,
    );
  }

  /**
   * Pick'ems abertos que o usuário ainda não preencheu (card da home).
   * Endpoint ainda a implementar no backend — ver PICKEM_FRONT_API.md.
   * Enquanto não existir, o backend responde 404 e o front esconde o card.
   */
  public pendingForMe(): Observable<IPendingPickemResponse[]> {
    return this._http.get<IPendingPickemResponse[]>(
      `${this._baseUrl}/api/users/me/pickems/pending`,
    );
  }
}
