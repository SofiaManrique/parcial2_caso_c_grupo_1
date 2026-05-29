import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PDFService {
  constructor(private http: HttpClient) {}

  getCertificate(radicado: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/pdf/certificado/${radicado}`, {
      responseType: 'blob'
    });
  }

  getActoAdministrativo(radicado: string, decision: string, justificacion: string): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/pdf/acto-administrativo`, {
      radicado,
      decision,
      justificacion
    }, {
      responseType: 'blob'
    });
  }

  getAuditReport(fechaInicio: string, fechaFin: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/pdf/reporte-auditoria`, {
      params: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      },
      responseType: 'blob'
    });
  }
}
