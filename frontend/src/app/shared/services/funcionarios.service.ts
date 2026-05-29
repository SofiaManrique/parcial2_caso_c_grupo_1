import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FuncionariosService {
  constructor(private http: HttpClient) {}

  createFuncionario(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/admin/funcionarios`, data);
  }

  getFuncionarios(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/intranet/funcionarios`);
  }

  getDependencias(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/intranet/dependencias`);
  }
}
