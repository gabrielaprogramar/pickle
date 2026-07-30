export interface IntensityResult {
  readonly ghg_intensity_gco2e_per_mj: number;
  readonly total_energy_mj: number;
  readonly total_emissions_gco2e: number;
}

/**
 * Compute the annual GHG intensity.
 *
 * Formula:
 *   ghg_intensity = total_wtw_emissions / total_energy_input
 *
 * Returns 0 when total_energy is 0 (no fuel consumed).
 */
export function computeGhgIntensity(
  totalEnergyMj: number,
  totalEmissionsGco2e: number,
): IntensityResult {
  const intensity =
    totalEnergyMj > 0
      ? totalEmissionsGco2e / totalEnergyMj
      : 0;

  return {
    ghg_intensity_gco2e_per_mj: intensity,
    total_energy_mj: totalEnergyMj,
    total_emissions_gco2e: totalEmissionsGco2e,
  };
}
