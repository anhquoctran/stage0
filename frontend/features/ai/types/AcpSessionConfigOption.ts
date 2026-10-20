export interface AcpSessionConfigOption {
  id: string;
  name: string;
  description?: string;
  category?: string;
  reviewKind: 'model' | 'reasoning' | 'fastMode';
  type: 'select' | 'boolean';
  currentValue: string | boolean;
  options?: Array<{ value: string; name: string; description?: string }>;
}
