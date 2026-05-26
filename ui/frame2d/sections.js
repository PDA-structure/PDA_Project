// Steel section catalog — ported from marimo_spike/sections/ (source: SCI P363).
// Tata Steel Advance values match to within engineering tolerance (~0.1-0.3%).
//
// Units follow SCI Blue Book / Tata Advance convention:
//   Linear dims: mm | Area: cm2 | I: cm4 | W: cm3 | I_T: cm4 | I_w: dm6 | Mass: kg/m
//
// The designation string (e.g. "UKB 356x171x45") is the lookup key for marimo
// design checks — keep in sync with marimo_spike/sections/*.py.

const STEEL_SECTIONS = {
  UKB: {
    "305x165x46": {
      designation: "UKB 305x165x46", type: "UKB", mass_per_m: 46.1,
      h: 306.6, b: 165.7, t_w: 6.7, t_f: 11.8, r: 8.9,
      A: 58.7, I_y: 9899, W_pl_y: 720, W_el_y: 646,
      I_z: 968, I_T: 22.2, I_w: 0.195,
    },
    "356x127x33": {
      designation: "UKB 356x127x33", type: "UKB", mass_per_m: 33.1,
      h: 349.0, b: 125.4, t_w: 6.0, t_f: 8.5, r: 10.2,
      A: 42.1, I_y: 8249, W_pl_y: 543, W_el_y: 473,
      I_z: 280, I_T: 8.79, I_w: 0.0810,
    },
    "356x171x45": {
      designation: "UKB 356x171x45", type: "UKB", mass_per_m: 45.0,
      h: 351.4, b: 171.1, t_w: 7.0, t_f: 9.7, r: 10.2,
      A: 57.3, I_y: 12100, W_pl_y: 775, W_el_y: 687,
      I_z: 811, I_T: 15.8, I_w: 0.237,
    },
    "406x178x60": {
      designation: "UKB 406x178x60", type: "UKB", mass_per_m: 60.1,
      h: 406.4, b: 177.9, t_w: 7.9, t_f: 12.8, r: 10.2,
      A: 76.5, I_y: 21600, W_pl_y: 1199, W_el_y: 1063,
      I_z: 1203, I_T: 33.3, I_w: 0.466,
    },
    "457x191x67": {
      designation: "UKB 457x191x67", type: "UKB", mass_per_m: 67.1,
      h: 453.4, b: 189.9, t_w: 8.5, t_f: 12.7, r: 10.2,
      A: 85.5, I_y: 29400, W_pl_y: 1471, W_el_y: 1296,
      I_z: 1452, I_T: 37.1, I_w: 0.705,
    },
    "533x210x92": {
      designation: "UKB 533x210x92", type: "UKB", mass_per_m: 92.1,
      h: 533.1, b: 209.3, t_w: 10.1, t_f: 15.6, r: 12.7,
      A: 117.0, I_y: 55200, W_pl_y: 2360, W_el_y: 2070,
      I_z: 2390, I_T: 75.7, I_w: 1.60,
    },
  },
  UKC: {
    "152x152x37": {
      designation: "UKC 152x152x37", type: "UKC", mass_per_m: 37.0,
      h: 161.8, b: 154.4, t_w: 8.0, t_f: 11.5, r: 7.6,
      A: 47.1, I_y: 2210, W_pl_y: 309, W_el_y: 273,
      I_z: 706, I_T: 19.2, I_w: 0.0399,
    },
    "203x203x46": {
      designation: "UKC 203x203x46", type: "UKC", mass_per_m: 46.1,
      h: 203.2, b: 203.6, t_w: 7.2, t_f: 11.0, r: 10.2,
      A: 58.7, I_y: 4570, W_pl_y: 497, W_el_y: 450,
      I_z: 1548, I_T: 22.2, I_w: 0.143,
    },
    "203x203x60": {
      designation: "UKC 203x203x60", type: "UKC", mass_per_m: 60.0,
      h: 209.6, b: 205.8, t_w: 9.4, t_f: 14.2, r: 10.2,
      A: 76.4, I_y: 6125, W_pl_y: 656, W_el_y: 584,
      I_z: 2065, I_T: 47.2, I_w: 0.197,
    },
    "254x254x73": {
      designation: "UKC 254x254x73", type: "UKC", mass_per_m: 73.1,
      h: 254.1, b: 254.6, t_w: 8.6, t_f: 14.2, r: 12.7,
      A: 93.1, I_y: 11400, W_pl_y: 992, W_el_y: 898,
      I_z: 3908, I_T: 57.6, I_w: 0.562,
    },
    "305x305x97": {
      designation: "UKC 305x305x97", type: "UKC", mass_per_m: 96.9,
      h: 307.9, b: 305.3, t_w: 9.9, t_f: 15.4, r: 15.2,
      A: 124.0, I_y: 22300, W_pl_y: 1592, W_el_y: 1450,
      I_z: 7308, I_T: 91.2, I_w: 1.56,
      W_pl_z: 726, W_el_z: 478.8,
    },
  },
};

const STEEL_GRADES = {
  S275: { name: "S275", f_y: 275, f_u: 410 },
  S355: { name: "S355", f_y: 355, f_u: 470 },
  S460: { name: "S460", f_y: 460, f_u: 540 },
};
