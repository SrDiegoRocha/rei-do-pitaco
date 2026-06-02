import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class BracketService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  public get(
    tournamentId: string,
    phaseId: string,
  ): Observable<IBracketResponse> {
    return this._http.get<IBracketResponse>(
      `${this._baseUrl}/api/tournaments/${tournamentId}/phases/${phaseId}/bracket`,
    );
  }
}
