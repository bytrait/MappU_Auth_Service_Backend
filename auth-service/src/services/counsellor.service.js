const prisma = require("../prisma/prisma");
const { generateUniqueReferenceCode } = require("../utils/referenceCode");
const {
  upsertReferenceTokenPrice,
  deactivateReferenceTokenPrice,
} = require("../utils/billingClient.util");
const {
  HttpError,
  badRequest,
  notFound,
  conflict,
} = require("../utils/HttpError");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a value claims to be a UUID. Prisma `findUnique({ where: { id }})`
 * will accept any string and produce a confusing error when the id is junk;
 * pre-validating gives the FE a clean 400 instead of a 500.
 */
const assertUuid = (value, fieldName) => {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw badRequest(`Invalid ${fieldName}`);
  }
};

/**
 * Normalize an incoming date-ish value (Date | ISO string | null/undefined)
 * into either a `Date` or `null`. Throws a 400 on malformed input.
 */
const toDateOrNull = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`Invalid ${fieldName}`);
  }
  return date;
};

/**
 * Validate price + currency for any flow that forwards them to billing.
 *
 *  - price must be a finite, non-negative number when provided
 *  - currency, if provided, must be a 3-letter ISO 4217 code (we don't
 *    enforce the whitelist here so new currencies can be added by billing
 *    without an auth-service deploy)
 *
 * Returns `{ price, currency }` (possibly `{ price: undefined }` if not set).
 */
const validatePriceAndCurrency = ({ price, currency }) => {
  if (price !== undefined && price !== null) {
    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw badRequest("price must be a number");
    }
    if (price < 0) {
      throw badRequest("price must be non-negative");
    }
  }
  if (currency !== undefined && currency !== null && currency !== "") {
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      throw badRequest("currency must be a 3-letter ISO code (e.g. INR, USD)");
    }
  }
  return { price, currency };
};

/**
 * Normalize + validate a custom reference code coming from the frontend.
 * Codes are always stored upper-case so lookups by code stay deterministic.
 */
const normalizeCustomCode = (code) => {
  if (typeof code !== "string" || code.trim() === "") {
    throw badRequest("Reference code is required", { code: "CODE_REQUIRED" });
  }
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(trimmed)) {
    throw badRequest(
      "Reference code must be 4-20 characters and contain only letters and numbers",
      { code: "CODE_FORMAT_INVALID" }
    );
  }
  return trimmed;
};

/**
 * Hard-fail when the given code is already taken. Pre-checking lets us
 * surface a friendly "already in use" message instead of leaking the raw
 * Prisma unique-constraint error. The fallback P2002 catch in `safeCreate`
 * handles the rare race-condition case.
 */
const assertCodeAvailable = async (code) => {
  const existing = await prisma.referenceCode.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) {
    throw conflict("This reference code is already in use", {
      code: "CODE_IN_USE",
    });
  }
};

/**
 * Wrap `prisma.referenceCode.create` so a concurrent insert with the same
 * code (race past `assertCodeAvailable`) still returns a clean 409.
 */
const safeCreateReferenceCode = async (data) => {
  try {
    return await prisma.referenceCode.create({ data });
  } catch (e) {
    if (
      e?.code === "P2002" &&
      (e?.meta?.target?.includes?.("code") ||
        e?.meta?.target === "ReferenceCode_code_key")
    ) {
      throw conflict("This reference code is already in use", {
        code: "CODE_IN_USE",
      });
    }
    throw e;
  }
};

/**
 * Sync token price with the billing service. Pricing is owned by billing,
 * we only forward the value. When `price` is undefined/null the call is a
 * no-op.
 */
const syncTokenPriceWithBilling = async ({
  token,
  counsellorId,
  price,
  currency,
  requestId,
}) => {
  if (price === undefined || price === null) return null;

  return upsertReferenceTokenPrice({
    tokenId: token.id,
    code: token.code,
    type: token.type,
    targetId: token.targetId,
    counsellorId,
    price,
    currency,
    startDate: token.startDate,
    expiryDate: token.expiryDate,
    label: token.label,
    requestId,
  });
};

const counsellorMustExist = async (counsellorId) => {
  if (!counsellorId) throw badRequest("Counsellor ID is required");
  assertUuid(counsellorId, "counsellorId");

  const counsellor = await prisma.user.findUnique({
    where: { id: counsellorId },
  });
  if (!counsellor || counsellor.role !== "COUNSELLOR") {
    throw notFound("Counsellor not found");
  }
  return counsellor;
};

const schoolMustBelongToCounsellor = async ({ counsellorId, schoolId }) => {
  assertUuid(schoolId, "schoolId");
  const school = await prisma.school.findFirst({
    where: { id: schoolId, counsellorId },
  });
  if (!school) throw notFound("School not found or access denied");
  return school;
};

// ---------------------------------------------------------------------------
// Counsellor reference codes (legacy single-active helpers preserved)
// ---------------------------------------------------------------------------

const rotateCounsellorReferenceCodeService = async ({ counsellorId }) => {
  await counsellorMustExist(counsellorId);

  await prisma.referenceCode.updateMany({
    where: { targetId: counsellorId, type: "COUNSELLOR", isActive: true },
    data: { isActive: false },
  });

  const newCode = await generateUniqueReferenceCode();
  const referenceCode = await prisma.referenceCode.create({
    data: {
      code: newCode,
      type: "COUNSELLOR",
      targetId: counsellorId,
      isActive: true,
    },
  });

  return { code: referenceCode.code };
};

const getCounsellorReferenceCodeService = async (counsellorId) => {
  if (!counsellorId) throw badRequest("Counsellor ID is required");

  const now = new Date();
  const reference = await prisma.referenceCode.findFirst({
    where: {
      targetId: counsellorId,
      type: "COUNSELLOR",
      isActive: true,
      OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });

  if (!reference) throw notFound("Reference code not found for counsellor");
  return reference;
};

// ---------------------------------------------------------------------------
// Multi-token APIs (counsellor)
// ---------------------------------------------------------------------------

const createCounsellorReferenceTokenService = async ({
  counsellorId,
  code,
  label,
  startDate,
  expiryDate,
  price,
  currency,
  requestId,
}) => {
  await counsellorMustExist(counsellorId);

  const normalizedCode = normalizeCustomCode(code);
  validatePriceAndCurrency({ price, currency });

  const start = toDateOrNull(startDate, "startDate") || new Date();
  const expiry = toDateOrNull(expiryDate, "expiryDate");
  if (expiry && expiry <= start) {
    throw badRequest("expiryDate must be after startDate");
  }

  await assertCodeAvailable(normalizedCode);

  const token = await safeCreateReferenceCode({
    code: normalizedCode,
    type: "COUNSELLOR",
    targetId: counsellorId,
    label: label || null,
    startDate: start,
    expiryDate: expiry,
    isActive: true,
  });

  try {
    await syncTokenPriceWithBilling({
      token,
      counsellorId,
      price,
      currency,
      requestId,
    });
  } catch (err) {
    await prisma.referenceCode.delete({ where: { id: token.id } });
    throw err;
  }

  return token;
};

const listCounsellorReferenceTokensService = async ({
  counsellorId,
  includeInactive = false,
}) => {
  await counsellorMustExist(counsellorId);

  return prisma.referenceCode.findMany({
    where: {
      targetId: counsellorId,
      type: "COUNSELLOR",
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
  });
};

// ---------------------------------------------------------------------------
// Multi-token APIs (school)
// ---------------------------------------------------------------------------

const createSchoolReferenceTokenService = async ({
  counsellorId,
  schoolId,
  code,
  label,
  startDate,
  expiryDate,
  price,
  currency,
  requestId,
}) => {
  const school = await schoolMustBelongToCounsellor({ counsellorId, schoolId });
  if (!school.isActive) {
    throw conflict("Cannot create a token for an inactive school");
  }

  const normalizedCode = normalizeCustomCode(code);
  validatePriceAndCurrency({ price, currency });

  const start = toDateOrNull(startDate, "startDate") || new Date();
  const expiry = toDateOrNull(expiryDate, "expiryDate");
  if (expiry && expiry <= start) {
    throw badRequest("expiryDate must be after startDate");
  }

  await assertCodeAvailable(normalizedCode);

  const token = await safeCreateReferenceCode({
    code: normalizedCode,
    type: "SCHOOL",
    targetId: schoolId,
    label: label || null,
    startDate: start,
    expiryDate: expiry,
    isActive: true,
  });

  try {
    await syncTokenPriceWithBilling({
      token,
      counsellorId,
      price,
      currency,
      requestId,
    });
  } catch (err) {
    await prisma.referenceCode.delete({ where: { id: token.id } });
    throw err;
  }

  return token;
};

const listSchoolReferenceTokensService = async ({
  counsellorId,
  schoolId,
  includeInactive = false,
}) => {
  await schoolMustBelongToCounsellor({ counsellorId, schoolId });

  return prisma.referenceCode.findMany({
    where: {
      targetId: schoolId,
      type: "SCHOOL",
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
  });
};

// ---------------------------------------------------------------------------
// Generic token lifecycle (works for both COUNSELLOR & SCHOOL tokens)
// ---------------------------------------------------------------------------

const getOwnedToken = async ({ counsellorId, tokenId }) => {
  assertUuid(tokenId, "tokenId");

  const token = await prisma.referenceCode.findUnique({
    where: { id: tokenId },
  });
  if (!token) throw notFound("Reference token not found");

  if (token.type === "COUNSELLOR") {
    if (token.targetId !== counsellorId) {
      throw notFound("Reference token not found or access denied");
    }
  } else if (token.type === "SCHOOL") {
    await schoolMustBelongToCounsellor({
      counsellorId,
      schoolId: token.targetId,
    });
  } else {
    throw badRequest("Unsupported reference token type");
  }

  return token;
};

/**
 * Extend a token's expiry, optionally re-billing the price in the same
 * action. The DB update + billing call are wrapped so that if billing
 * fails we roll the expiryDate (and isActive flag) back to their previous
 * values - otherwise an extend-with-price failure would leave the token
 * row out of sync with billing.
 */
const extendReferenceTokenService = async ({
  counsellorId,
  tokenId,
  expiryDate,
  price,
  currency,
  requestId,
}) => {
  const token = await getOwnedToken({ counsellorId, tokenId });

  const newExpiry = toDateOrNull(expiryDate, "expiryDate");
  if (!newExpiry) throw badRequest("expiryDate is required");
  if (newExpiry <= new Date()) {
    throw badRequest("expiryDate must be in the future");
  }
  if (token.startDate && newExpiry <= token.startDate) {
    throw badRequest("expiryDate must be after the token's startDate");
  }
  validatePriceAndCurrency({ price, currency });

  const previousExpiry = token.expiryDate;
  const previousIsActive = token.isActive;

  const updated = await prisma.referenceCode.update({
    where: { id: token.id },
    data: { expiryDate: newExpiry, isActive: true },
  });

  if (price !== undefined && price !== null) {
    try {
      await syncTokenPriceWithBilling({
        token: updated,
        counsellorId:
          updated.type === "COUNSELLOR" ? updated.targetId : counsellorId,
        price,
        currency,
        requestId,
      });
    } catch (err) {
      // Roll back the DB update so the token's expiryDate / isActive
      // never diverges from what billing actually has on record.
      await prisma.referenceCode.update({
        where: { id: token.id },
        data: { expiryDate: previousExpiry, isActive: previousIsActive },
      });
      throw err;
    }
  }

  return updated;
};

/**
 * Update a token's price only, without touching its expiryDate / label /
 * isActive. Useful for "Edit price" actions in the FE. No DB write happens
 * here - we just forward the new price to billing (which is the source of
 * truth for pricing).
 */
const updateReferenceTokenPriceService = async ({
  counsellorId,
  tokenId,
  price,
  currency,
  requestId,
}) => {
  if (price === undefined || price === null) {
    throw badRequest("price is required");
  }
  validatePriceAndCurrency({ price, currency });

  const token = await getOwnedToken({ counsellorId, tokenId });

  await syncTokenPriceWithBilling({
    token,
    counsellorId:
      token.type === "COUNSELLOR" ? token.targetId : counsellorId,
    price,
    currency,
    requestId,
  });

  return {
    tokenId: token.id,
    code: token.code,
    price,
    currency: currency || "INR",
  };
};

const deactivateReferenceTokenService = async ({
  counsellorId,
  tokenId,
  requestId,
}) => {
  const token = await getOwnedToken({ counsellorId, tokenId });

  if (!token.isActive) {
    // Idempotent: don't error out, just return current state. The FE
    // can rely on the response shape staying the same.
    return token;
  }

  const updated = await prisma.referenceCode.update({
    where: { id: token.id },
    data: { isActive: false },
  });

  // Best-effort: tell billing the price is no longer in use. Errors are
  // already swallowed inside `deactivateReferenceTokenPrice`.
  await deactivateReferenceTokenPrice({ tokenId: token.id, requestId });

  return updated;
};

// ---------------------------------------------------------------------------
// School CRUD (existing) - createSchool also mints the first reference token
// ---------------------------------------------------------------------------

const createSchoolService = async ({
  counsellorId,
  name,
  tokenCode,
  tokenLabel,
  tokenStartDate,
  tokenExpiryDate,
  price,
  currency,
  requestId,
}) => {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw badRequest("School name is required");
  }

  // Validate everything BEFORE creating the school so a bad payload never
  // leaves an orphaned school row behind.
  const normalizedCode = normalizeCustomCode(tokenCode);
  validatePriceAndCurrency({ price, currency });

  const start = toDateOrNull(tokenStartDate, "tokenStartDate") || new Date();
  const expiry = toDateOrNull(tokenExpiryDate, "tokenExpiryDate");
  if (expiry && expiry <= start) {
    throw badRequest("tokenExpiryDate must be after tokenStartDate");
  }

  await assertCodeAvailable(normalizedCode);

  const school = await prisma.school.create({
    data: { name: name.trim(), counsellorId },
  });

  let token;
  try {
    token = await safeCreateReferenceCode({
      code: normalizedCode,
      type: "SCHOOL",
      targetId: school.id,
      label: tokenLabel || null,
      startDate: start,
      expiryDate: expiry,
      isActive: true,
    });
  } catch (err) {
    // Token creation failed (e.g. race-condition duplicate) - roll back
    // the school.
    await prisma.school.delete({ where: { id: school.id } });
    throw err;
  }

  try {
    await syncTokenPriceWithBilling({
      token,
      counsellorId,
      price,
      currency,
      requestId,
    });
  } catch (err) {
    // Roll back token + school so we never persist a half-created school
    // whose price never made it into billing.
    await prisma.referenceCode.delete({ where: { id: token.id } });
    await prisma.school.delete({ where: { id: school.id } });
    throw err;
  }

  return { ...school, referenceToken: token };
};

const listSchoolsService = async ({ counsellorId }) => {
  return prisma.school.findMany({
    where: { counsellorId },
    orderBy: { createdAt: "desc" },
    include: {
      students: { select: { id: true } },
    },
  });
};

const updateSchoolService = async ({
  counsellorId,
  schoolId,
  name,
  isActive,
}) => {
  await schoolMustBelongToCounsellor({ counsellorId, schoolId });

  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    throw badRequest("School name must be a non-empty string");
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    throw badRequest("isActive must be a boolean");
  }

  return prisma.school.update({
    where: { id: schoolId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(isActive !== undefined && { isActive }),
    },
  });
};

const getSchoolStudentsService = async ({
  counsellorId,
  schoolId,
  page = 1,
  limit = 20,
  search = "",
}) => {
  const skip = (page - 1) * limit;

  await schoolMustBelongToCounsellor({ counsellorId, schoolId });

  const whereClause = {
    role: "STUDENT",
    counsellorId,
    schoolId,
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        contact: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  return {
    data: students,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

const getDirectStudentsService = async ({
  counsellorId,
  page = 1,
  limit = 20,
  search = "",
}) => {
  const skip = (page - 1) * limit;

  const whereClause = {
    role: "STUDENT",
    counsellorId,
    schoolId: null,
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        contact: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  return {
    data: students,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

const assignStudentToSchoolService = async ({
  counsellorId,
  schoolId,
  studentId,
}) => {
  assertUuid(schoolId, "schoolId");
  assertUuid(studentId, "studentId");

  const school = await prisma.school.findFirst({
    where: { id: schoolId, counsellorId, isActive: true },
    select: { id: true },
  });
  if (!school) throw notFound("School not found or inactive");

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", counsellorId },
  });
  if (!student) throw notFound("Student not found or access denied");

  return prisma.user.update({
    where: { id: studentId },
    data: { schoolId },
  });
};

const removeStudentFromSchoolService = async ({ counsellorId, studentId }) => {
  assertUuid(studentId, "studentId");

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", counsellorId },
  });
  if (!student) throw notFound("Student not found or access denied");

  return prisma.user.update({
    where: { id: studentId },
    data: { schoolId: null },
  });
};

const getSchoolReferenceCodeService = async ({ counsellorId, schoolId }) => {
  await schoolMustBelongToCounsellor({ counsellorId, schoolId });

  const now = new Date();
  return prisma.referenceCode.findFirst({
    where: {
      type: "SCHOOL",
      targetId: schoolId,
      isActive: true,
      OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, createdAt: true, expiryDate: true },
  });
};

const rotateSchoolReferenceCodeService = async ({ counsellorId, schoolId }) => {
  await schoolMustBelongToCounsellor({ counsellorId, schoolId });

  await prisma.referenceCode.updateMany({
    where: { type: "SCHOOL", targetId: schoolId, isActive: true },
    data: { isActive: false },
  });

  const code = await generateUniqueReferenceCode();
  return prisma.referenceCode.create({
    data: { code, type: "SCHOOL", targetId: schoolId },
  });
};

const markWelcomeShownService = async ({ counsellorId }) => {
  await prisma.user.update({
    where: { id: counsellorId },
    data: { welcomeShown: true },
  });
  return true;
};

module.exports = {
  // Legacy single-token API (still used by existing UIs)
  getCounsellorReferenceCodeService,
  rotateCounsellorReferenceCodeService,
  getSchoolReferenceCodeService,
  rotateSchoolReferenceCodeService,

  // Multi-token API
  createCounsellorReferenceTokenService,
  listCounsellorReferenceTokensService,
  createSchoolReferenceTokenService,
  listSchoolReferenceTokensService,
  extendReferenceTokenService,
  updateReferenceTokenPriceService,
  deactivateReferenceTokenService,

  // Schools
  createSchoolService,
  listSchoolsService,
  updateSchoolService,
  getSchoolStudentsService,
  getDirectStudentsService,
  assignStudentToSchoolService,
  removeStudentFromSchoolService,

  markWelcomeShownService,

  // Exposed for tests
  HttpError,
};
