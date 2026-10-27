import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'
import type { ScriptableContext, TooltipItem } from 'chart.js'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface RadarChartProps {
  labels: string[]
  requiredLevels: number[]
  candidateLevels: number[]
  verifiableDimensions: boolean[]
  series?: { label: string; levels: (number | null)[] }[]
}

export default function RadarChart({
  labels,
  requiredLevels,
  candidateLevels,
  verifiableDimensions,
  series,
}: RadarChartProps) {
  const data = {
    labels,
    datasets: [
      {
        label: '岗位要求等级',
        data: requiredLevels,
        borderColor: '#91a9bd',
        backgroundColor: 'rgba(26, 35, 126, 0.15)',
        pointBackgroundColor: '#1A237E',
        pointBorderColor: '#fff',
        pointHoverRadius: 5,
        borderWidth: 2,
        fill: true,
      },
      ...(series ? series.map((s, i) => ({ label: s.label, data: s.levels, borderColor: ['#72ddd2', '#b3a3ff', '#efbe77', '#82b7fb'][i], backgroundColor: 'transparent', borderWidth: 2, fill: false })) : [{
        label: '候选人得分',
        data: candidateLevels,
        borderColor: '#FF8F00',
        backgroundColor: 'rgba(255, 143, 0, 0.1)',
        pointBackgroundColor: function (ctx: ScriptableContext<'radar'>) {
          const i = ctx.dataIndex
          return verifiableDimensions[i] ? '#FF8F00' : 'rgba(255, 143, 0, 0.4)'
        },
        pointBorderColor: '#fff',
        pointHoverRadius: 5,
        borderWidth: 2,
        borderDash: [4, 4],
        fill: true,
      }]),
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 5,
        ticks: {
          stepSize: 1,
          font: {
            size: 11,
            family: 'Noto Sans SC',
          },
          color: '#9CA3AF',
          backdropColor: 'transparent',
        },
        grid: {
          color: 'rgba(160, 190, 220, 0.18)',
        },
        angleLines: {
          color: 'rgba(160, 190, 220, 0.18)',
        },
        pointLabels: {
          font: {
            size: 12,
            family: 'Noto Sans SC',
            weight: 'bold' as const,
          },
          color: '#afc5d7',
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            size: 12,
            family: 'Noto Sans SC',
          },
          padding: 16,
          usePointStyle: true,
          color: '#afc5d7',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleFont: {
          size: 13,
          family: 'Noto Sans SC',
        },
        bodyFont: {
          size: 12,
          family: 'Noto Sans SC',
        },
        titleColor: '#1F2937',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: function (context: TooltipItem<'radar'>) {
            return `${context.dataset.label}: ${context.raw} 级`
          },
        },
      },
    },
  }

  return (
    <div className="relative">
      <Radar data={data} options={options} />
      <div className="mt-3 text-center text-xs text-gray-400">
        * 仅供参考，非录用结论
      </div>
    </div>
  )
}
