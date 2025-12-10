export enum GoldenStatus {
  Idle = 'IDLE',
  Updating = 'UPDATING',
  PassedUpdate = 'PASSED_UPDATE',
  FailedUpdate = 'FAILED_UPDATE'
}

export enum TestResult {
  Passed = 'PASSED',
  Failed = 'FAILED',
  MissingReference = 'MISSING_REFERENCE',
  None = 'NONE'
}
