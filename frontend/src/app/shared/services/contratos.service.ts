import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContratosService {
  constructor(private http: HttpClient) {}

  getMisContratos(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/contratos/mis-contratos`);
  }

  getDocumentos(contrato_id: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/contratos/${contrato_id}/documentos`);
  }

  radicarDocumento(contrato_id: number, tipo: string, descripcion?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/contratos/${contrato_id}/radicar`, {
      tipo,
      descripcion
    });
  }
}
