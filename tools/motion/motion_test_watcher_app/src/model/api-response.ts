export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UpdateResult {
  id: string;
  status: 'PASSED_UPDATE' | 'FAILED_UPDATE';
  message?: string;
}

export interface BatchUpdateResult {
  results: UpdateResult[];
  passedCount: number;
  failedCount: number;
}
