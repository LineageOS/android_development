import { TruncatePipe } from './truncate.pipe';

describe('TruncatePipe', () => {
  let pipe: TruncatePipe;

  beforeEach(() => {
    pipe = new TruncatePipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return empty string for null or undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should not truncate if value is shorter than limit', () => {
    expect(pipe.transform('short', 10)).toBe('short');
  });

  it('should truncate at the end by default', () => {
    expect(pipe.transform('this is a very long string', 10)).toBe('this is a ...');
  });

  it('should truncate in the middle when specified', () => {
    const value = 'Cuttlefish_GMS_x86_64_0.0.0.0:6520';
    // limit 25, middle true. charsToShow = 22. front 11, back 11.
    // 'Cuttlefish_' (11) + '...' + '0.0.0.0:6520' (12) -> wait.
    // frontChars = ceil(22/2) = 11. backChars = floor(22/2) = 11.
    // value.substring(0, 11) -> 'Cuttlefish_'
    // value.substring(33 - 11) -> '0.0.0.0:6520' (34 - 11 = 23? no, length is 34? let's check)
    // 'Cuttlefish_GMS_x86_64_0.0.0.0:6520'.length -> 34
    // 34 - 11 = 23. substring(23) -> '0.0.0.0:6520' (11 chars)
    expect(pipe.transform(value, 25, true)).toBe('Cuttlefish_...0.0.0.0:6520');
  });
});
