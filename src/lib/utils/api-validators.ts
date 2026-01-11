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
  sourcePersonId?: string;
  sourcePersonIds?: string[];
  targetPersonId: string;
}

export function validateMergeInput(body: unknown): ValidationResult<MergeInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { sourcePersonId, sourcePersonIds, targetPersonId } = body as Record<string, unknown>;

  if (!isNonEmptyString(targetPersonId)) {
    return { valid: false, error: "targetPersonId musí být neprázdný řetězec", status: 400 };
  }

  let sources: string[] = [];
  if (isStringArray(sourcePersonIds) && sourcePersonIds.length > 0) {
    sources = sourcePersonIds;
  } else if (isNonEmptyString(sourcePersonId)) {
    sources = [sourcePersonId];
  } else {
    return {
      valid: false,
      error: "Musí být zadán sourcePersonId nebo sourcePersonIds",
      status: 400,
    };
  }

  if (sources.includes(targetPersonId)) {
    return { valid: false, error: "Nelze sloučit osobu se sebou samou", status: 400 };
  }

  return {
    valid: true,
    data: {
      sourcePersonId: sources.length === 1 ? sources[0] : undefined,
      sourcePersonIds: sources.length > 1 ? sources : undefined,
      targetPersonId,
    },
  };
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

export interface InvalidateDetectionsInput {
  personId: string;
  detections: Array<{
    imageId: string;
    box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

export function validateInvalidateDetectionsInput(
  body: unknown,
): ValidationResult<InvalidateDetectionsInput> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Neplatné tělo požadavku", status: 400 };
  }

  const { personId, imageId, box, detections } = body as Record<string, unknown>;

  if (!isNonEmptyString(personId)) {
    return { valid: false, error: "personId musí být neprázdný řetězec", status: 400 };
  }

  const finalDetections: InvalidateDetectionsInput["detections"] = [];

  // Support legacy single detection
  if (isNonEmptyString(imageId)) {
    // If box is present, validate it
    let validatedBox: InvalidateDetectionsInput["detections"][0]["box"] | undefined;

    if (box && typeof box === "object") {
      const { x, y, width, height } = box as Record<string, unknown>;
      if (
        typeof x === "number" &&
        typeof y === "number" &&
        typeof width === "number" &&
        typeof height === "number"
      ) {
        validatedBox = { x, y, width, height };
      }
    }
    // Only push if box was valid OR it wasn't provided at all (force invalidation)
    if (box === undefined || validatedBox) {
      finalDetections.push({ imageId, box: validatedBox });
    }
  }

  // Support bulk detections
  if (Array.isArray(detections)) {
    for (const d of detections) {
      if (d && typeof d === "object" && isNonEmptyString(d.imageId)) {
        let validatedBox: InvalidateDetectionsInput["detections"][0]["box"] | undefined;

        if (d.box && typeof d.box === "object") {
          const { x, y, width, height } = d.box;
          if (
            typeof x === "number" &&
            typeof y === "number" &&
            typeof width === "number" &&
            typeof height === "number"
          ) {
            validatedBox = { x, y, width, height };
          }
        }

        // Allow if box is explicitly undefined (force) OR if provided box is valid
        // If box is provided but INVALID, we skip this detection to be safe
        if (d.box === undefined || validatedBox) {
          finalDetections.push({ imageId: d.imageId, box: validatedBox });
        }
      }
    }
  }

  if (finalDetections.length === 0) {
    return {
      valid: false,
      error: "Musí být zadána alespoň jedna platná detekce k zneplatnění",
      status: 400,
    };
  }

  return {
    valid: true,
    data: {
      personId,
      detections: finalDetections,
    },
  };
}
