// src/utils/referenceCode.js

const prisma = require('../prisma/prisma');
const { badRequest, notFound } = require('./HttpError');

/**
 * Normalize a reference code entered by a student (or counsellor) before
 * lookup. Stored codes are upper-case; rules match counsellor token creation.
 */
const normalizeReferenceCodeInput = (code) => {
  if (typeof code !== 'string' || code.trim() === '') {
    throw badRequest('Reference code is required', { code: 'CODE_REQUIRED' });
  }
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(trimmed)) {
    throw badRequest(
      'Reference code must be 4-20 characters and contain only letters and numbers',
      { code: 'CODE_FORMAT_INVALID' }
    );
  }
  return trimmed;
};

/**
 * Generate a unique human-friendly reference code
 */
const generateUniqueReferenceCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    exists = await prisma.referenceCode.findUnique({
      where: { code },
      select: { id: true },
    });
  }

  return code;
};

/**
 * Resolve a reference code into counsellorId & schoolId.
 *
 * A code is considered valid when:
 *   - it exists in the DB
 *   - `isActive` is true
 *   - `startDate` is in the past (or unset)
 *   - `expiryDate` is in the future (or unset)
 *
 * @param {string | undefined} code
 * @returns {Promise<{ counsellorId: string | null, schoolId: string | null, referenceCodeId: string | null }>}
 */
const resolveReferenceCode = async (code) => {
  // No reference code → independent student
  if (!code) {
    return { counsellorId: null, schoolId: null, referenceCodeId: null };
  }

  const reference = await prisma.referenceCode.findUnique({
    where: { code },
  });

  if (!reference || !reference.isActive) {
    throw notFound('Invalid or inactive reference code', {
      code: 'CODE_INVALID',
    });
  }

  const now = new Date();
  if (reference.startDate && reference.startDate > now) {
    throw badRequest('Reference code is not yet active', {
      code: 'CODE_NOT_YET_ACTIVE',
    });
  }
  if (reference.expiryDate && reference.expiryDate <= now) {
    throw badRequest('Reference code has expired', { code: 'CODE_EXPIRED' });
  }

  // Handle based on reference type
  switch (reference.type) {
    case 'COUNSELLOR': {
      return {
        counsellorId: reference.targetId,
        schoolId: null,
        referenceCodeId: reference.id,
      };
    }

    case 'SCHOOL': {
      const school = await prisma.school.findUnique({
        where: { id: reference.targetId },
        select: { id: true, counsellorId: true, isActive: true },
      });

      if (!school || !school.isActive) {
        throw notFound('Invalid or inactive school reference', {
          code: 'SCHOOL_INACTIVE',
        });
      }

      return {
        counsellorId: school.counsellorId,
        schoolId: school.id,
        referenceCodeId: reference.id,
      };
    }

    default:
      throw badRequest('Unsupported reference code type');
  }
};

module.exports = {
  generateUniqueReferenceCode,
  normalizeReferenceCodeInput,
  resolveReferenceCode,
};