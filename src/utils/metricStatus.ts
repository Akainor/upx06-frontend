export type MetricAttribute = 'ph' | 'turbidez' | 'temp' | 'tds';
export type MetricStatus = 'verde' | 'amarelo' | 'vermelho';

interface MetricStatusInput {
  isSuccessful: boolean;
  value: number;
  evaluator: {
    isEnabled: boolean;
  };
}

export function getMetricStatus(
  metric: MetricStatusInput | undefined,
  attribute: MetricAttribute,
): MetricStatus {
  if (!metric) return 'vermelho';
  if (!metric.evaluator.isEnabled) return 'amarelo';

  if (attribute === 'ph') {
    if (metric.value < 6.5 || metric.value > 9.5) return 'vermelho';
    if (metric.value <= 7 || metric.value >= 9) return 'amarelo';
    return 'verde';
  }

  if (attribute === 'turbidez') {
    if (metric.value < 0 || metric.value > 1) return 'vermelho';
    return metric.value >= 0.5 ? 'amarelo' : 'verde';
  }

  if (attribute === 'tds') {
    if (metric.value < 0 || metric.value > 600) return 'vermelho';
    return metric.value >= 500 ? 'amarelo' : 'verde';
  }

  return metric.isSuccessful ? 'verde' : 'vermelho';
}
