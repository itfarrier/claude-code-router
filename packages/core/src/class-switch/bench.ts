export async function recordClassRefusal(
  _status: number,
  _provider: string,
  _model: string
): Promise<void> {
  return;
}

export function isBenched(_provider: string, _model: string): boolean {
  return false;
}