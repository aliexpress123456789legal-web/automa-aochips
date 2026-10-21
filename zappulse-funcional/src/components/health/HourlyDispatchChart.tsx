import React, { useState } from 'react';
import { HourlyTelemetry } from '../../types';

interface HourlyDispatchChartProps {
  telemetry: HourlyTelemetry[];
}

export const HourlyDispatchChart: React.FC<HourlyDispatchChartProps> = ({ telemetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxSent = Math.max(...telemetry.map((t) => t.sent), 120);
  const chartHeight = 180;
  const chartWidth = 720;
  const paddingX = 20;
  const paddingY = 25;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  // Calculate coordinates for SVG area and line
  const points = telemetry.map((item, idx) => {
    const x = paddingX + (idx / (telemetry.length - 1)) * innerWidth;
    const y = chartHeight - paddingY - (item.sent / maxSent) * innerHeight;
    return { x, y, item, idx };
  });

  const pathD = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  const total24h = telemetry.reduce((acc, t) => acc + t.sent, 0);
  const totalReplied24h = telemetry.reduce((acc, t) => acc + t.replied, 0);
  const totalFailed24h = telemetry.reduce((acc, t) => acc + t.failed, 0);

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Curva de Disparos das Últimas 24 Horas
          </h3>
          <p className="text-xs text-slate-400">
            Distribuição horária do volume enviado por todas as instâncias em operação
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <div>
            <span className="text-slate-400">Total: </span>
            <span className="text-white font-semibold">{total24h.toLocaleString('pt-BR')} msgs</span>
          </div>
          <div>
            <span className="text-slate-400">Respostas: </span>
            <span className="text-emerald-400 font-semibold">{totalReplied24h}</span>
          </div>
          <div>
            <span className="text-slate-400">Falhas: </span>
            <span className="text-rose-400 font-semibold">{totalFailed24h}</span>
          </div>
        </div>
      </div>

      {/* SVG Responsive Container */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-48 overflow-visible"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight - paddingY - ratio * innerHeight;
            const value = Math.round(ratio * maxSent);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={paddingX}
                  y={y - 4}
                  fill="#475569"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical indicator & data points */}
          {points.map((pt) => {
            const isHovered = hoveredIdx === pt.idx;
            const hasActivity = pt.item.sent > 0;

            return (
              <g
                key={pt.idx}
                onMouseEnter={() => setHoveredIdx(pt.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Invisible hover zone */}
                <rect
                  x={pt.x - innerWidth / (telemetry.length * 2)}
                  y={paddingY}
                  width={innerWidth / telemetry.length}
                  height={innerHeight}
                  fill="transparent"
                />

                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={paddingY}
                    x2={pt.x}
                    y2={chartHeight - paddingY}
                    stroke="#34d399"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}

                {hasActivity && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5 : 2.5}
                    fill={isHovered ? '#34d399' : '#10b981'}
                    className="transition-all duration-150"
                  />
                )}
              </g>
            );
          })}

          {/* Bottom X-Axis hour markers */}
          {telemetry.map((t, idx) => {
            // Show every 3rd hour to avoid crowding
            if (idx % 3 !== 0 && idx !== telemetry.length - 1) return null;
            const x = paddingX + (idx / (telemetry.length - 1)) * innerWidth;
            return (
              <text
                key={idx}
                x={x}
                y={chartHeight - 4}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10"
                fontFamily="monospace"
              >
                {t.hour}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIdx !== null && (
          <div
            className="absolute top-2 pointer-events-none p-2 rounded-lg bg-slate-950/95 border border-slate-700/80 shadow-xl text-xs z-20 backdrop-blur-sm"
            style={{
              left: `${Math.min(
                Math.max(10, (hoveredIdx / (telemetry.length - 1)) * 90),
                75
              )}%`,
            }}
          >
            <div className="font-mono font-semibold text-slate-200">
              Hora: {telemetry[hoveredIdx].hour}
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
              • Enviadas: {telemetry[hoveredIdx].sent} msgs
            </div>
            <div className="text-[11px] text-blue-400 font-mono">
              • Respostas: {telemetry[hoveredIdx].replied} leads
            </div>
            {telemetry[hoveredIdx].failed > 0 && (
              <div className="text-[11px] text-rose-400 font-mono">
                • Falhas: {telemetry[hoveredIdx].failed}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
        <span>Horário comercial de maior taxa de resposta: 09h às 12h e 14h às 17h</span>
        <span className="font-mono text-emerald-400">Média: {Math.round(total24h / 24)} msgs/hora</span>
      </div>
    </div>
  );
};
