const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Plan de Organización Doméstica - Familia Armas</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      page-break-after: always;
      padding: 4px;
      position: relative;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 2px solid #e2e8f0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-badge {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      font-weight: 800;
      font-size: 16px;
      padding: 6px 12px;
      border-radius: 8px;
      letter-spacing: -0.5px;
    }

    .header-text h1 {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4px;
    }

    .header-text p {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }

    .meta-badge {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 5px 10px;
      text-align: right;
      font-size: 9px;
      color: #475569;
    }

    .meta-badge strong {
      display: block;
      color: #0f172a;
      font-size: 11px;
    }

    /* SECTION HEADERS */
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin: 12px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-title::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #e2e8f0;
      margin-left: 8px;
    }

    /* KPI CARDS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: center;
    }

    .kpi-val {
      font-size: 16px;
      font-weight: 800;
      color: #2563eb;
    }

    .kpi-label {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 2px;
    }

    /* SIBLINGS SCHEDULE CARDS */
    .siblings-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .sibling-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }

    .sibling-header {
      padding: 8px 10px;
      font-weight: 700;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sibling-sebas .sibling-header { background: #eff6ff; color: #1e40af; border-bottom: 2px solid #3b82f6; }
    .sibling-silvana .sibling-header { background: #fdf2f8; color: #9d174d; border-bottom: 2px solid #ec4899; }
    .sibling-samuel .sibling-header { background: #f0fdf4; color: #166534; border-bottom: 2px solid #22c55e; }

    .sibling-body {
      padding: 8px 10px;
      font-size: 9.5px;
    }

    .sibling-item {
      margin-bottom: 5px;
      display: flex;
      gap: 4px;
    }

    .sibling-item:last-child {
      margin-bottom: 0;
    }

    .sibling-item strong {
      color: #334155;
      min-width: 65px;
    }

    /* CHORES DEFINITIONS */
    .chores-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }

    .chore-card {
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 10px;
    }

    .chore-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .chore-sofi .chore-title { color: #d97706; }
    .chore-cocina .chore-title { color: #ea580c; }
    .chore-lavar .chore-title { color: #2563eb; }

    .chore-list {
      list-style: none;
      font-size: 9.5px;
    }

    .chore-list li {
      position: relative;
      padding-left: 12px;
      margin-bottom: 4px;
      color: #475569;
    }

    .chore-list li::before {
      content: "•";
      position: absolute;
      left: 2px;
      color: #94a3b8;
      font-weight: bold;
    }

    /* RULES BANNER */
    .rules-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 8px 12px;
      margin-top: 10px;
      font-size: 9.5px;
      color: #92400e;
    }

    .rules-box strong {
      color: #78350f;
    }

    /* MAIN TABLE */
    .schedule-table-wrap {
      margin: 12px 0 16px 0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 10.5px;
    }

    .schedule-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    .schedule-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    .schedule-table tr:last-child td {
      border-bottom: none;
    }

    .schedule-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .day-badge {
      font-weight: 700;
      color: #0f172a;
      display: inline-block;
      width: 80px;
    }

    .tag-sibling {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.2px;
    }

    .tag-sebas { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .tag-silvana { background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; }
    .tag-samuel { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

    /* SUMMARY STATS TABLE */
    .balance-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .balance-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
    }

    .balance-header {
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .balance-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: 9.5px;
      color: #475569;
      border-bottom: 1px dashed #f1f5f9;
    }

    .balance-row:last-child {
      border-bottom: none;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
    }

    /* DAYS JUSTIFICATION LIST */
    .justification-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }

    .day-card {
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 8px 10px;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .day-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      font-size: 10.5px;
      color: #0f172a;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 1px solid #f1f5f9;
    }

    .day-card p {
      font-size: 9px;
      color: #475569;
      margin-bottom: 3px;
    }

    .day-card p strong {
      color: #1e293b;
    }

    .highlight-friday {
      border: 2px solid #f59e0b;
      background: #fffdf5;
    }

    /* FOOTER */
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- ==================== PÁGINA 1 ==================== -->
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">DINOW</div>
        <div class="header-text">
          <h1>Plan de Organización Doméstica y Deberes</h1>
          <p>Familia Armas • Sistema Semanal Equitativo de Rotación y Convivencia</p>
        </div>
      </div>
      <div class="meta-badge">
        <strong>Válido: Semanal</strong>
        Zona: America/Caracas (3:00 AM)
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-val">21</div>
        <div class="kpi-label">Deberes Semanales</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">7 / 7 / 7</div>
        <div class="kpi-label">Equidad Exacta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">3</div>
        <div class="kpi-label">Obligaciones Diarias</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">03:00 AM</div>
        <div class="kpi-label">Cierre de Jornada</div>
      </div>
    </div>

    <!-- HORARIOS BASE -->
    <div class="section-title">1. Contexto Logístico y Horarios de los Hermanos</div>
    <div class="siblings-grid">
      <div class="sibling-card sibling-sebas">
        <div class="sibling-header">
          <span>Sebastián</span>
          <span>🚗 Comparte carro</span>
        </div>
        <div class="sibling-body">
          <div class="sibling-item"><strong>Lunes:</strong> Clases 8:00 AM - 5:50 PM</div>
          <div class="sibling-item"><strong>Martes:</strong> Clases 12:00 PM - 3:50 PM (Mañana libre)</div>
          <div class="sibling-item"><strong>Miércoles:</strong> Sin clases. Voleibol 6:00 - 9:00 PM</div>
          <div class="sibling-item"><strong>Jueves:</strong> Clases 8:00 AM - 1:50 PM (Espera a Silvana)</div>
          <div class="sibling-item"><strong>Viernes:</strong> Clases 7:00 - 11:50 AM + Voleibol 6 - 9 PM</div>
          <div class="sibling-item"><strong>Sáb / Dom:</strong> 100% Libre</div>
        </div>
      </div>

      <div class="sibling-card sibling-silvana">
        <div class="sibling-header">
          <span>Silvana</span>
          <span>🚗 Comparte carro</span>
        </div>
        <div class="sibling-body">
          <div class="sibling-item"><strong>Lunes:</strong> Clases 9:00 AM - 5:00 PM (Sale 7:30 con Sebas)</div>
          <div class="sibling-item"><strong>Martes:</strong> Clases 7:00 AM - 3:00 PM (Cola amiga)</div>
          <div class="sibling-item"><strong>Miércoles:</strong> Clases 9:00 AM - 1:00 PM + Voleibol 6 - 9 PM</div>
          <div class="sibling-item"><strong>Jueves:</strong> Clases 9:00 AM - 5:00 PM (Sale 5:45 con Sebas)</div>
          <div class="sibling-item"><strong>Viernes:</strong> Clases 9:00 - 11:00 AM + Voleibol 6 - 9 PM</div>
          <div class="sibling-item"><strong>Sábado:</strong> Emprendimiento 8:00 - 10:00 AM | Dom: Libre</div>
        </div>
      </div>

      <div class="sibling-card sibling-samuel">
        <div class="sibling-header">
          <span>Samuel</span>
          <span>🚙 Carro propio</span>
        </div>
        <div class="sibling-body">
          <div class="sibling-item"><strong>Lunes - Vie:</strong> Trabajo fijo 8:00 AM - 6:00 PM</div>
          <div class="sibling-item"><strong>Entreno:</strong> Gimnasio 6:00 PM - 8:00 PM</div>
          <div class="sibling-item"><strong>Llegada:</strong> Llega a casa aprox. 8:30 PM</div>
          <div class="sibling-item"><strong>Carro:</strong> Se moviliza de forma independiente</div>
          <div class="sibling-item"><strong>Sábado:</strong> 100% Libre todo el día</div>
          <div class="sibling-item"><strong>Domingo:</strong> 100% Libre todo el día</div>
        </div>
      </div>
    </div>

    <!-- DEFINICIÓN DE DEBERES -->
    <div class="section-title">2. Criterios de las 3 Obligaciones Fijas Diarias</div>
    <div class="chores-grid">
      <div class="chore-card chore-sofi">
        <div class="chore-title">🐾 Sofi (Cuidado Canino)</div>
        <ul class="chore-list">
          <li><strong>Paseo de la mañana:</strong> Salida matutina + servir comida y agua fresca.</li>
          <li><strong>Paseo de la tarde/noche:</strong> Salida entre 5:30 y 6:30 PM (no muy tarde para evitar accidentes).</li>
          <li><strong>Comida nocturna:</strong> Servir cena y rellenar agua antes de dormir.</li>
          <li><strong>Limpieza de accidentes:</strong> Recoger cualquier necesidad dentro de casa y desinfectar.</li>
        </ul>
      </div>

      <div class="chore-card chore-cocina">
        <div class="chore-title">🍳 Cocina (Alimentación)</div>
        <ul class="chore-list">
          <li><strong>Almuerzo del día:</strong> Cocinado la noche anterior o en la mañana (en potes para llevar).</li>
          <li><strong>Cena del día:</strong> Preparar cena caliente y completa para los tres hermanos.</li>
          <li><strong>Orden:</strong> Dejar mesones limpios y sartenes/ollas en el lavaplatos.</li>
          <li><em>Nota de descanso:</em> Quien tenga mañana libre no cocina para no romper su descanso.</li>
        </ul>
      </div>

      <div class="chore-card chore-lavar">
        <div class="chore-title">🍽️ Lavar (Platos y Orden)</div>
        <ul class="chore-list">
          <li><strong>Limpieza total:</strong> Lavar todos los platos, vasos y potes traídos de la uni/trabajo.</li>
          <li><strong>Ollas y sartenes:</strong> Fregar todo lo utilizado por la persona de Cocina.</li>
          <li><strong>Cierre de noche:</strong> Fregadero y escurridor 100% limpios y ordenados antes de dormir.</li>
          <li><em>Sin excepciones:</em> No se dejan platos sucios para el día siguiente.</li>
        </ul>
      </div>
    </div>

    <div class="rules-box">
      <strong>⚠️ Regla de Logística Conjunta (Carro):</strong> Sebastián y Silvana salen juntos en la mañana a la hora del que entra más temprano (6:30 o 7:30 AM) y regresan juntos al finalizar las actividades del último. Los viernes ambos permanecen en la universidad de 11:50 AM a 9:00 PM por entrenamiento de voleibol.
    </div>

    <div class="footer">
      <span>Dinow House Management System • Familia Armas</span>
      <span>Página 1 de 3</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 2 ==================== -->
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">DINOW</div>
        <div class="header-text">
          <h1>Matriz de Asignaciones y Balance Semanal</h1>
          <p>Distribución definitiva de deberes aprobada para los 7 días de la semana</p>
        </div>
      </div>
      <div class="meta-badge">
        <strong>Cuadrante Oficial</strong>
        Ciclo Continuo
      </div>
    </div>

    <!-- TABLA PRINCIPAL -->
    <div class="section-title">3. Tabla Oficial de Asignaciones (Lunes a Domingo)</div>
    <div class="schedule-table-wrap">
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Día</th>
            <th>🐾 Sofi (Paseos y Cuidados)</th>
            <th>🍳 Cocina (Almuerzo y Cena)</th>
            <th>🍽️ Lavar (Platos del Día)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="day-badge">LUNES</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
          </tr>
          <tr>
            <td><span class="day-badge">MARTES</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
          </tr>
          <tr>
            <td><span class="day-badge">MIÉRCOLES</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
          </tr>
          <tr>
            <td><span class="day-badge">JUEVES</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
          </tr>
          <tr style="background: #fffbeb;">
            <td><span class="day-badge" style="color: #b45309;">VIERNES ⭐</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
          </tr>
          <tr>
            <td><span class="day-badge">SÁBADO</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
          </tr>
          <tr>
            <td><span class="day-badge">DOMINGO</span></td>
            <td><span class="tag-sibling tag-samuel">Samuel</span></td>
            <td><span class="tag-sibling tag-sebas">Sebastián</span></td>
            <td><span class="tag-sibling tag-silvana">Silvana</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- BALANCE Y ESTADÍSTICAS -->
    <div class="section-title">4. Balance de Equidad y Conteo por Hermano</div>
    <div class="balance-grid">
      <div class="balance-card">
        <div class="balance-header">
          <span style="color: #1e40af;">Sebastián</span>
          <span class="tag-sibling tag-sebas">7 Tareas</span>
        </div>
        <div class="balance-row"><span>🐾 Sofi:</span> <strong>3 (Mar, Mié, Sáb)</strong></div>
        <div class="balance-row"><span>🍳 Cocina:</span> <strong>2 (Jue, Dom)</strong></div>
        <div class="balance-row"><span>🍽️ Lavar:</span> <strong>2 (Lun, Vie)</strong></div>
        <div class="balance-row"><span>Total Semanal:</span> <strong>7 Deberes (33.3%)</strong></div>
      </div>

      <div class="balance-card">
        <div class="balance-header">
          <span style="color: #9d174d;">Silvana</span>
          <span class="tag-sibling tag-silvana">7 Tareas</span>
        </div>
        <div class="balance-row"><span>🐾 Sofi:</span> <strong>2 (Lun, Jue)</strong></div>
        <div class="balance-row"><span>🍳 Cocina:</span> <strong>2 (Mar, Vie)</strong></div>
        <div class="balance-row"><span>🍽️ Lavar:</span> <strong>3 (Mié, Sáb, Dom)</strong></div>
        <div class="balance-row"><span>Total Semanal:</span> <strong>7 Deberes (33.3%)</strong></div>
      </div>

      <div class="balance-card">
        <div class="balance-header">
          <span style="color: #166534;">Samuel</span>
          <span class="tag-sibling tag-samuel">7 Tareas</span>
        </div>
        <div class="balance-row"><span>🐾 Sofi:</span> <strong>2 (Vie, Dom)</strong></div>
        <div class="balance-row"><span>🍳 Cocina:</span> <strong>3 (Lun, Mié, Sáb)</strong></div>
        <div class="balance-row"><span>🍽️ Lavar:</span> <strong>2 (Mar, Jue)</strong></div>
        <div class="balance-row"><span>Total Semanal:</span> <strong>7 Deberes (33.3%)</strong></div>
      </div>
    </div>

    <!-- EL PROTOCOLO ESPECIAL DEL VIERNES -->
    <div class="section-title">5. Protocolo Especial de Contingencia: El Viernes</div>
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 9.5px; line-height: 1.5;">
      <p style="margin-bottom: 6px;"><strong>¿Por qué el Viernes cambia el esquema habitual?</strong> Sebastián y Silvana salen juntos a las 6:30 AM y pasan 15 horas seguidas fuera de casa (clases de mañana + tarde estudiando + voleibol de 6:00 a 9:00 PM), llegando a casa a las 9:30 PM.</p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px;">
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
          <strong style="color: #d97706;">🐾 Sofi → Samuel</strong><br>
          Al ser el único que sale del trabajo a las 6:00 PM y llega antes (6:30 o 8:30 PM), Samuel saca a Sofi. Si esperaran a las 9:30 PM, Sofi tendría accidentes.
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
          <strong style="color: #ea580c;">🍳 Cocina → Silvana</strong><br>
          El almuerzo del viernes lo cocina Sebastián el jueves en la noche. Silvana solo se encarga de una cena práctica y rápida al llegar en la noche.
        </div>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px;">
          <strong style="color: #2563eb;">🍽️ Lavar → Sebastián</strong><br>
          Como durante el día nadie come en casa, los platos son únicamente los de la noche. Sebastián lava todos los potes y vajilla tras cenar a las 9:30 PM.
        </div>
      </div>
    </div>

    <div class="footer">
      <span>Dinow House Management System • Familia Armas</span>
      <span>Página 2 de 3</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 3 ==================== -->
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">DINOW</div>
        <div class="header-text">
          <h1>Justificación Estratégica Día por Día</h1>
          <p>Explicación operativa y reglamento de convivencia doméstica</p>
        </div>
      </div>
      <div class="meta-badge">
        <strong>Reglamento Oficial</strong>
        Familia Armas
      </div>
    </div>

    <div class="section-title">6. Justificación Operativa por Día</div>
    <div class="justification-grid">
      <div class="day-card">
        <div class="day-card-header">
          <span>LUNES</span>
          <span style="font-size: 8.5px; color: #64748b;">Inicio de semana</span>
        </div>
        <p><strong>🐾 Silvana:</strong> Llega con Sebas a las 6:30 PM de clases y saca a Sofi de una vez.</p>
        <p><strong>🍳 Samuel:</strong> El almuerzo ya quedó preparado el domingo en la noche; Samuel hace la cena al volver del entreno.</p>
        <p><strong>🍽️ Sebastián:</strong> Tras un día largo de clases, lava los platos de la noche antes de acostarse.</p>
      </div>

      <div class="day-card">
        <div class="day-card-header">
          <span>MARTES</span>
          <span style="font-size: 8.5px; color: #64748b;">Sebas entra tarde</span>
        </div>
        <p><strong>🐾 Sebastián:</strong> Entra a las 12 PM. Saca a Sofi relajado a las 9 AM y al volver a las 4:30 PM. No madruga a cocinar.</p>
        <p><strong>🍳 Silvana:</strong> Sale temprano de clases (3:00 PM). Tiene la tarde para cocinar la cena familiar.</p>
        <p><strong>🍽️ Samuel:</strong> Llega a las 8:30 PM de entrenar, cena y lava los platos.</p>
      </div>

      <div class="day-card">
        <div class="day-card-header">
          <span>MIÉRCOLES</span>
          <span style="font-size: 8.5px; color: #64748b;">Sebas libre / Volley</span>
        </div>
        <p><strong>🐾 Sebastián:</strong> Día libre de clases. Saca a Sofi descansado y a las 5:30 PM antes del voleibol.</p>
        <p><strong>🍳 Samuel:</strong> Cocina la cena para que cuando Sebas y Silvana lleguen del voleibol a las 9:30 PM esté lista.</p>
        <p><strong>🍽️ Silvana:</strong> Al llegar del voleibol y cenar caliente, lava los platos nocturnos.</p>
      </div>

      <div class="day-card">
        <div class="day-card-header">
          <span>JUEVES</span>
          <span style="font-size: 8.5px; color: #64748b;">Cierre universitario</span>
        </div>
        <p><strong>🐾 Silvana:</strong> Llega a casa a las 5:45 PM y saca a Sofi antes de que anochezca.</p>
        <p><strong>🍳 Sebastián:</strong> Cocina la cena del jueves y <em>deja listos los potes de almuerzo del viernes</em> para llevar.</p>
        <p><strong>🍽️ Samuel:</strong> Llega a las 8:30 PM y lava los platos utilizados en la noche.</p>
      </div>

      <div class="day-card highlight-friday">
        <div class="day-card-header">
          <span style="color: #b45309;">VIERNES (Día Crítico)</span>
          <span style="font-size: 8.5px; color: #b45309;">15h fuera Sebas/Silvana</span>
        </div>
        <p><strong>🐾 Samuel:</strong> Es el único en la casa a buena hora (8:30 PM o antes). Evita que Sofi se haga pipí.</p>
        <p><strong>🍳 Silvana:</strong> Almuerzo ya preparado el jueves. Silvana resuelve cena rápida a las 9:30 PM.</p>
        <p><strong>🍽️ Sebastián:</strong> Lava todos los platos acumulados de la cena y potes universitarios.</p>
      </div>

      <div class="day-card">
        <div class="day-card-header">
          <span>SÁBADO</span>
          <span style="font-size: 8.5px; color: #64748b;">Fin de semana</span>
        </div>
        <p><strong>🐾 Sebastián:</strong> Está 100% libre y atiende a Sofi con paseos prolongados.</p>
        <p><strong>🍳 Samuel:</strong> Día libre de trabajo. Cocina con calma almuerzo y cena sin apuros laborales.</p>
        <p><strong>🍽️ Silvana:</strong> Tras su clase matutina de las 10:00 AM, lava los platos del día.</p>
      </div>

      <div class="day-card" style="grid-column: span 2;">
        <div class="day-card-header">
          <span>DOMINGO</span>
          <span style="font-size: 8.5px; color: #64748b;">Preparación de semana</span>
        </div>
        <p><strong>🐾 Samuel:</strong> Atiende a Sofi en su día de descanso dominical completo.</p>
        <p><strong>🍳 Sebastián:</strong> Cocina almuerzo y cena del domingo y deja adelantado el almuerzo del lunes para todos.</p>
        <p><strong>🍽️ Silvana:</strong> Cierra el ciclo semanal lavando la vajilla dominical, dejando la cocina impecable para el lunes.</p>
      </div>
    </div>

    <!-- REGLAMENTO DOMÉSTICO -->
    <div class="section-title">7. Reglas de Oro del Reglamento Dinow</div>
    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 9px; line-height: 1.5;">
      <ul style="list-style: none; padding-left: 0;">
        <li style="margin-bottom: 4px;"><strong>1. Cierre a las 3:00 AM:</strong> Toda tarea completada antes de las 3:00 AM cuenta para el día en curso (Horario de Caracas).</li>
        <li style="margin-bottom: 4px;"><strong>2. Coberturas y Suplencias:</strong> Si alguien no puede cumplir, puede acordar una cobertura. El bono por cubrir solo se otorga si el suplente cumplió su propia tarea y el titular confirma la ayuda en la app.</li>
        <li style="margin-bottom: 4px;"><strong>3. Responsabilidad Colectiva:</strong> Sofi, Cocina y Lavar son deberes obligatorios. Si ninguno de los tres cumple una tarea no negociable, hay penalización para todo el hogar.</li>
        <li><strong>4. Libro Mayor Dinow:</strong> Ningún punto se sobrescribe; todo queda registrado y auditado con transparencia para los tres hermanos.</li>
      </ul>
    </div>

    <div class="footer">
      <span>Dinow House Management System • Familia Armas</span>
      <span>Página 3 de 3</span>
    </div>
  </div>

</body>
</html>
`;

const htmlPath = path.join(__dirname, 'plan_deberes.html');
const pdfPath = path.join(__dirname, '..', 'Plan_Semanal_Deberes_Familia_Armas.pdf');

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('HTML generado en:', htmlPath);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const command = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;

console.log('Ejecutando Edge headless para generar PDF...');
try {
  execSync(command, { stdio: 'inherit' });
  console.log('PDF generado exitosamente en:', pdfPath);
} catch (err) {
  console.error('Error generando PDF con Edge:', err);
  process.exit(1);
}
