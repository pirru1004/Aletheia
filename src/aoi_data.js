export const aoiData = [
  {
    id: 'groundbirch',
    name: 'Groundbirch',
    year: 2025,
    asset_type: 'Upstream',
    country: 'Canada',
    latitude: 55.9,
    longitude: -120.9,
    reported: {
      flaring_bcm: 0.02,
      methane_tonnes: 3400,
      co2_tonnes: 1100000,
      no2_tonnes: 450
    },
    observed: {
      flaring_bcm: 0.025,
      methane_tonnes: 8500,
      co2_tonnes: 1200000,
      no2_tonnes: 480
    },
    agentic_interpretation: "Operator reports 3,400 tonnes of methane per year. TROPOMI L2 observation (applying CNN-based plume detection) estimates an annualised 8,500 tonnes (±20%). Discrepancy: +150%. This exceeds the combined uncertainty bound. VIIRS Nightfire flaring observation is relatively consistent (0.025 BCM vs 0.02 BCM). Conclusion: Candidate for unlit flaring or venting events exceeding baseline declaration.",
    trends: {
      labels: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
      methane: [3000, 3100, 3150, 4200, 6800, 8500, 9200, 10500, 12000, 13100, 14500],
      flaring_bcm: [0.015, 0.018, 0.020, 0.022, 0.024, 0.025, 0.026, 0.027, 0.028, 0.029, 0.030],
      co2_tonnes: [1000000, 1050000, 1080000, 1150000, 1180000, 1200000, 1220000, 1250000, 1280000, 1310000, 1350000],
      no2_tonnes: [400, 420, 430, 450, 460, 480, 490, 510, 520, 540, 560]
    }
  },
  {
    id: 'pearl_gtl',
    name: 'Pearl GTL',
    year: 2025,
    asset_type: 'GTL',
    country: 'Qatar',
    latitude: 25.9,
    longitude: 51.55,
    reported: {
      flaring_bcm: 0.05,
      methane_tonnes: 2100,
      co2_tonnes: 5400000,
      no2_tonnes: 1200
    },
    observed: {
      flaring_bcm: 0.048,
      methane_tonnes: 1950,
      co2_tonnes: 5500000,
      no2_tonnes: 1250
    },
    agentic_interpretation: "Operator reports 0.05 BCM of flaring in 2025; VIIRS Nightfire observation estimates 0.048 BCM (±25%). Methane enhancement is statistically insignificant above regional background (TROPOMI), consistent with the reported 2,100 tonnes. TROPOMI NO2 indicates sustained activity levels. Verdict: High compliance confidence. Satellite observations are tightly aligned with reported baseline.",
    trends: {
      labels: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
      methane: [2200, 2150, 2100, 2050, 2000, 1950, 1900, 1850, 1800, 1750, 1700],
      flaring_bcm: [0.060, 0.058, 0.055, 0.052, 0.050, 0.048, 0.045, 0.042, 0.040, 0.038, 0.035],
      co2_tonnes: [5000000, 5100000, 5200000, 5300000, 5400000, 5500000, 5550000, 5600000, 5650000, 5700000, 5750000],
      no2_tonnes: [1100, 1150, 1180, 1200, 1220, 1250, 1260, 1270, 1280, 1290, 1300]
    }
  },
  {
    id: 'prelude_flng',
    name: 'Prelude FLNG',
    year: 2025,
    asset_type: 'FLNG',
    country: 'Australia',
    latitude: -20.596,  // Moved to onshore Western Australia (Karratha Gas Plant area)
    longitude: 116.772,
    reported: {
      flaring_bcm: 'approximate',
      methane_tonnes: 1600,
      co2_tonnes: 2000000,
      no2_tonnes: 300
    },
    observed: {
      flaring_bcm: 0.12,
      methane_tonnes: 4200,
      co2_tonnes: 2150000,
      no2_tonnes: 850,
      sar_slicks: 2 // Added SAR slick mock
    },
    agentic_interpretation: "Operator reports approximate flaring. VIIRS attributes 0.12 BCM to the facility buffer. Methane derived from TROPOMI shows frequent transit-style plumes yielding an estimated 4,200 tonnes. Additionally, Sentinel-1 SAR (C-band VV) identifies 2 candidate oil slicks trailing the facility with no associated IOPCF or national regulator spill report. Verdict: Low compliance confidence due to SAR slicks and elevated methane emissions.",
    trends: {
      labels: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
      methane: [1500, 1600, 2000, 2800, 3500, 4200, 4800, 5500, 6200, 7000, 7800],
      flaring_bcm: [0.05, 0.06, 0.08, 0.10, 0.11, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22],
      co2_tonnes: [1900000, 1950000, 2000000, 2050000, 2100000, 2150000, 2200000, 2250000, 2300000, 2350000, 2400000],
      no2_tonnes: [500, 550, 600, 700, 780, 850, 920, 980, 1050, 1100, 1180]
    }
  },
  {
    id: 'scotford_complex',
    name: 'Scotford Complex',
    year: 2025,
    asset_type: 'Refinery',
    country: 'Canada',
    latitude: 53.72,
    longitude: -113.1,
    reported: {
      flaring_bcm: 'approximate',
      methane_tonnes: 900,
      co2_tonnes: 4200000,
      no2_tonnes: 2100
    },
    observed: {
      flaring_bcm: 0.03,
      methane_tonnes: 850,
      co2_tonnes: 3900000,
      no2_tonnes: 2050
    },
    agentic_interpretation: "Operator reports approximate flaring and 900 tonnes of methane. VIIRS Nightfire confirms consistent, high-efficiency combustion. TROPOMI NO2 cross-check indicates typical refinery lean combustion. Methane enhancement (850 tonnes) is within the uncertainty bounds of the reported baseline. Verdict: Medium-High compliance confidence. Observations match expected refinery signatures.",
    trends: {
      labels: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
      methane: [1000, 950, 920, 890, 870, 850, 830, 810, 790, 770, 750],
      flaring_bcm: [0.04, 0.038, 0.035, 0.033, 0.031, 0.030, 0.028, 0.027, 0.026, 0.025, 0.024],
      co2_tonnes: [4500000, 4400000, 4200000, 4100000, 4000000, 3900000, 3800000, 3700000, 3600000, 3500000, 3400000],
      no2_tonnes: [2300, 2250, 2200, 2150, 2100, 2050, 2000, 1950, 1900, 1850, 1800]
    }
  }
];
