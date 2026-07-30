/**
 * FuelEU — OPS (On-shore Power Supply) data handling.
 *
 * OPS energy received at berth can reduce the vessel's GHG intensity.
 * If OPS data is unavailable for a reporting period this is flagged so the
 * calculation result reflects the data gap.
 */

export interface OpsResult {
  readonly ops_energy_mj: number;
  readonly ops_data_available: boolean;
}

/**
 * Process OPS (shore power) consumption for the reporting period.
 *
 * @param opsEnergyMj — total MWh consumed from on-shore power, converted to MJ
 * @param opsDataAvailable — whether OPS consumption data was collected
 */
export function processOpsData(
  opsEnergyMj: number = 0,
  opsDataAvailable: boolean = false,
): OpsResult {
  return {
    ops_energy_mj: Math.max(0, opsEnergyMj),
    ops_data_available: opsDataAvailable,
  };
}
