import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';
import { toHttpParams } from '@core/http/query-params';
import { IPage, IPageParams } from '@core/interfaces/api.interface';
import { TeamScope, TeamType } from '@core/interfaces/enums';
import {
  ICreateTeamRequest,
  ITeamFiltersResponse,
  ITeamResponse,
  IUpdateTeamRequest,
} from '@core/interfaces/team.interface';
import { API_BASE_URL } from '@core/services/api-config';

export interface ITeamListParams extends IPageParams {
  scope?: TeamScope;
  type?: TeamType;
  /** `countryCode` exato, case-insensitive. Times de usuário não têm país. */
  country?: string;
  /** `leagueSlug` exato. Só clubes do sistema têm liga. */
  league?: string;
}

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  /** Só muda quando entra liga nova no seed — uma chamada por sessão. */
  private _systemFilters$: Observable<ITeamFiltersResponse> | null = null;

  public list(params?: ITeamListParams): Observable<IPage<ITeamResponse>> {
    return this._http.get<IPage<ITeamResponse>>(`${this._baseUrl}/api/teams`, {
      params: toHttpParams(params ?? null),
    });
  }

  /** Países e ligas com clube no sistema, com as contagens. Cacheado. */
  public systemFilters(): Observable<ITeamFiltersResponse> {
    this._systemFilters$ ??= this._http
      .get<ITeamFiltersResponse>(`${this._baseUrl}/api/teams/system/filters`)
      .pipe(
        // Sem isto o shareReplay guardaria o erro para sempre e a tela nunca
        // se recuperaria de uma falha de rede pontual.
        catchError((err: unknown) => {
          this._systemFilters$ = null;
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this._systemFilters$;
  }

  public getById(id: string): Observable<ITeamResponse> {
    return this._http.get<ITeamResponse>(`${this._baseUrl}/api/teams/${id}`);
  }

  public create(payload: ICreateTeamRequest): Observable<ITeamResponse> {
    return this._http.post<ITeamResponse>(
      `${this._baseUrl}/api/teams`,
      payload,
    );
  }

  public update(
    id: string,
    payload: IUpdateTeamRequest,
  ): Observable<ITeamResponse> {
    return this._http.put<ITeamResponse>(
      `${this._baseUrl}/api/teams/${id}`,
      payload,
    );
  }

  public remove(id: string): Observable<void> {
    return this._http.delete<void>(`${this._baseUrl}/api/teams/${id}`);
  }
}
