export type DeviceOption = {
  id: string;
  name: string;
  chip_capacity: number;
  is_active?: boolean;
};

export type DeviceOccupancy = {
  id: string;
  device_id?: string | null;
  device_slot?: number | null;
};

export function isDeviceSlotTaken(
  numbers: DeviceOccupancy[],
  deviceId: string,
  slot: number,
  currentNumberId?: string,
): boolean {
  return numbers.some(
    (number) =>
      number.id !== currentNumberId && number.device_id === deviceId && number.device_slot === slot,
  );
}

export function getFirstAvailableSlot(
  numbers: DeviceOccupancy[],
  device: DeviceOption | undefined,
  currentNumberId?: string,
): string {
  if (!device) return "1";

  for (let slot = 1; slot <= device.chip_capacity; slot += 1) {
    if (!isDeviceSlotTaken(numbers, device.id, slot, currentNumberId)) {
      return String(slot);
    }
  }

  return "1";
}

export function formatDeviceLocation(deviceName?: string | null, slot?: number | null): string {
  if (deviceName && slot) return `${deviceName} - Chip ${slot}`;
  if (deviceName) return `${deviceName} - Sem chip`;
  return "Sem chip";
}
