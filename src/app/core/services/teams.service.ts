import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from '@core/http/query-params';
import { IPage, IPageParams } from '@core/interfaces/api.interface';
import { TeamScope, TeamType } from '@core/interfaces/enums';
import {
  ICreateTeamRequest,
  ITeamResponse,
  IUpdateTeamRequest,
} from '@core/interfaces/team.interface';
import { API_BASE_URL } from '@core/services/api-config';

export interface ITeamListParams extends IPageParams {
  scope?: TeamScope;
  type?: TeamType;
}

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);

  public list(params?: ITeamListParams): Observable<IPage<ITeamResponse>> {
    return this._http.get<IPage<ITeamResponse>>(`${this._baseUrl}/api/teams`, {
      params: toHttpParams(params ?? null),
    });
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
