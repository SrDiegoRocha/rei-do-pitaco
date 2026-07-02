import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  IRankingFilterParams,
  IRankingRowResponse,
} from '@core/interfaces/ranking.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class RankingService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  public list(
    tournamentId: string,
    filters?: IRankingFilterParams,
  ): Observable<IRankingRowResponse[]> {
    let params = new HttpParams();
    if (filters?.phaseId) params = params.set('phaseId', filters.phaseId);
    if (filters?.groupId) params = params.set('groupId', filters.groupId);
    if (filters?.round != null) {
      params = params.set('round', String(filters.round));
    }
    if (filters?.matchType) params = params.set('matchType', filters.matchType);
    if (filters?.memberStatus) {
      params = params.set('memberStatus', filters.memberStatus);
    }
    return this._http.get<IRankingRowResponse[]>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/ranking`,
      { params },
    );
  }
}
