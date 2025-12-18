export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string; status: number };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export interface MergeInput {
  sourcePersonId: string;
  targetPersonId: string;
}

export function validateMergeInput(body: unknown): ValidationResult<MergeInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { sourcePersonId, targetPersonId } = body as Record<string, unknown>;

  if (!isNonEmptyString(sourcePersonId)) {
    return { valid: false, error: "sourcePersonId musí být neprázdný řetězec", status: 400 };
  }

  if (!isNonEmptyString(targetPersonId)) {
    return { valid: false, error: "targetPersonId musí být neprázdný řetězec", status: 400 };
  }

  if (sourcePersonId === targetPersonId) {
    return { valid: false, error: "Nelze sloučit osobu se sebou samou", status: 400 };
  }

  return { valid: true, data: { sourcePersonId, targetPersonId } };
}

export interface RenameInput {
  personId: string;
  name: string;
}

export function validateRenameInput(body: unknown): ValidationResult<RenameInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, name } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  if (!isNonEmptyString(name)) {
    return { valid: false, error: "name musí být neprázdný řetězec", status: 400 };
  }

  const sanitizedName = name.trim().slice(0, 100);
  if (/[\/\\<>:"|?*]/.test(sanitizedName)) {
    return { valid: false, error: "Jméno obsahuje nepovolené znaky", status: 400 };
  }

  return { valid: true, data: { personId, name: sanitizedName } };
}

export interface UnmatchInput {
  personId: string;
  imageIds: string[];
}

export function validateUnmatchInput(body: unknown): ValidationResult<UnmatchInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, imageId, imageIds } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  let ids: string[];
  if (imageIds !== undefined) {
    if (!isStringArray(imageIds) || imageIds.length === 0) {
      return { valid: false, error: "imageIds musí být neprázdné pole řetězců", status: 400 };
    }
    ids = imageIds;
  } else if (isNonEmptyString(imageId)) {
    ids = [imageId];
  } else {
    return { valid: false, error: "Musí být zadán imageId nebo imageIds", status: 400 };
  }

  return { valid: true, data: { personId, imageIds: ids } };
}

export interface IgnoreInput {
  personId: string;
  ignored: boolean;
}

export function validateIgnoreInput(body: unknown): ValidationResult<IgnoreInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, ignored } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  if (typeof ignored !== "boolean") {
    return { valid: false, error: "ignored musí být boolean", status: 400 };
  }

  return { valid: true, data: { personId, ignored } };
}
