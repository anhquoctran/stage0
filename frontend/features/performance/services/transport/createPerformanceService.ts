import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { PerformanceService } from './PerformanceService';

export function createPerformanceService(transport: CommandTransport): PerformanceService {
  return {
    getPerformanceMetrics: () => transport.executeCommand('get_performance_metrics'),
  };
}
