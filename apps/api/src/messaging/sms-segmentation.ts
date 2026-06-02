export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsSegmentCalculation {
  encoding: SmsEncoding;
  length: number;
  segments: number;
}

const GSM_BASIC_CHARS = new Set(
  [
    "@",
    "£",
    "$",
    "¥",
    "è",
    "é",
    "ù",
    "ì",
    "ò",
    "Ç",
    "\n",
    "Ø",
    "ø",
    "\r",
    "Å",
    "å",
    "Δ",
    "_",
    "Φ",
    "Γ",
    "Λ",
    "Ω",
    "Π",
    "Ψ",
    "Σ",
    "Θ",
    "Ξ",
    "Æ",
    "æ",
    "ß",
    "É",
    " ",
    "!",
    '"',
    "#",
    "¤",
    "%",
    "&",
    "'",
    "(",
    ")",
    "*",
    "+",
    ",",
    "-",
    ".",
    "/",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    ":",
    ";",
    "<",
    "=",
    ">",
    "?",
    "¡",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "Ä",
    "Ö",
    "Ñ",
    "Ü",
    "§",
    "¿",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "ä",
    "ö",
    "ñ",
    "ü",
    "à",
  ],
);

const GSM_EXTENSION_CHARS = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

export function calculateSmsSegments(body: string): SmsSegmentCalculation {
  let gsmSeptets = 0;
  let isGsm = true;

  for (const char of body) {
    if (GSM_BASIC_CHARS.has(char)) {
      gsmSeptets += 1;
    } else if (GSM_EXTENSION_CHARS.has(char)) {
      gsmSeptets += 2;
    } else {
      isGsm = false;
      break;
    }
  }

  if (isGsm) {
    return {
      encoding: "GSM-7",
      length: gsmSeptets,
      segments: countSegments(gsmSeptets, 160, 153),
    };
  }

  const ucs2Units = body.length;
  return {
    encoding: "UCS-2",
    length: ucs2Units,
    segments: countSegments(ucs2Units, 70, 67),
  };
}

function countSegments(length: number, singleLimit: number, concatLimit: number): number {
  if (length <= 0) return 0;
  if (length <= singleLimit) return 1;
  return Math.ceil(length / concatLimit);
}
