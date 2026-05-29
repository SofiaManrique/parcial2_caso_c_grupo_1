import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TramitesService {
  constructor(private http: HttpClient) {}

  radicar(catalogo_id: number, descripcion?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/tramites/radicar`, {
      catalogo_id,
      descripcion
    });
  }

  getMyTramites(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tramites/mis-tramites`);
  }

  getTramite(radicado: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tramites/${radicado}`);
  }

  getCatalogo(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/tramites/catalogo`);
  }

  getFuncionarioTramite(radicado: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/intranet/tramites/${radicado}`);
  }

  updateStatus(radicado: string, estado: string, observaciones?: string): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/intranet/tramites/${radicado}/estado`, {
      estado,
      observaciones
    });
  }
}
