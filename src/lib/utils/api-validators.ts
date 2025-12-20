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
  if (/[/\\<>:"|?*]/.test(sanitizedName)) {
    return { valid: false, error: "Jméno obsahuje nepovolené znaky", status: 400 };
  }

  return { valid: true, data: { personId, name: sanitizedName } };
}

export interface UnmatchInput {
  personId: string;
  imageIds: string[];
  ignore?: boolean;
}

export function validateUnmatchInput(body: unknown): ValidationResult<UnmatchInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, imageId, imageIds, ignore } = body as Record<string, unknown>;

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

  return {
    valid: true,
    data: {
      personId,
      imageIds: ids,
      ignore: typeof ignore === "boolean" ? ignore : undefined,
    },
  };
}

export interface ReassignInput {
  sourcePersonId: string;
  targetPersonId: string;
  imageIds: string[];
}

export function validateReassignInput(body: unknown): ValidationResult<ReassignInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { sourcePersonId, targetPersonId, imageIds } = body as Record<string, unknown>;

  if (!isNonEmptyString(sourcePersonId)) {
    return { valid: false, error: "sourcePersonId musí být neprázdný řetězec", status: 400 };
  }

  if (!isNonEmptyString(targetPersonId)) {
    return { valid: false, error: "targetPersonId musí být neprázdný řetězec", status: 400 };
  }

  if (sourcePersonId === targetPersonId) {
    return { valid: false, error: "Nelze přiřadit ke stejné osobě", status: 400 };
  }

  if (!isStringArray(imageIds) || imageIds.length === 0) {
    return { valid: false, error: "imageIds musí být neprázdné pole řetězců", status: 400 };
  }

  return { valid: true, data: { sourcePersonId, targetPersonId, imageIds } };
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

export interface IgnoreFaceInput {
  personId: string;
  imageId: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export function validateIgnoreFaceInput(body: unknown): ValidationResult<IgnoreFaceInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, imageId, box } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  if (!isNonEmptyString(imageId)) {
    return { valid: false, error: "imageId musí být neprázdný řetězec", status: 400 };
  }

  if (!box || typeof box !== "object") {
    return { valid: false, error: "box musí být objekt", status: 400 };
  }

  const { x, y, width, height } = box as Record<string, unknown>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return { valid: false, error: "souřadnice boxu musí být čísla", status: 400 };
  }

  return {
    valid: true,
    data: {
      personId,
      imageId,
      box: { x, y, width, height },
    },
  };
}

export interface UpdateCategoryInput {
  personId: string;
  category: "person" | "statue" | "painting";
}

export function validateUpdateCategoryInput(body: unknown): ValidationResult<UpdateCategoryInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, category } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  if (category !== "person" && category !== "statue" && category !== "painting") {
    return { valid: false, error: "Neplatná kategorie", status: 400 };
  }

  return {
    valid: true,
    data: {
      personId,
      category: category as "person" | "statue" | "painting",
    },
  };
}

export interface MarkAsJunkInput {
  personId: string;
}

export function validateMarkAsJunkInput(body: unknown): ValidationResult<MarkAsJunkInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  return {
    valid: true,
    data: { personId },
  };
}
