// src/utils/referenceCode.js

const prisma = require('../prisma/prisma');

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
 * Resolve a reference code into counsellorId & schoolId
 *
 * @param {string | undefined} code
 * @returns {Promise<{ counsellorId: string | null, schoolId: string | null }>}
 */
const resolveReferenceCode = async (code) => {
  // No reference code → independent student
  if (!code) {
    return { counsellorId: null, schoolId: null };
  }

  const reference = await prisma.referenceCode.findUnique({
    where: { code },
  });

  if (!reference || !reference.isActive) {
    throw new Error('Invalid or inactive reference code');
  }

  // Handle based on reference type
  switch (reference.type) {
    case 'COUNSELLOR': {
      return {
        counsellorId: reference.targetId,
        schoolId: null,
      };
    }

    case 'SCHOOL': {
      const school = await prisma.school.findUnique({
        where: { id: reference.targetId },
        select: { id: true, counsellorId: true, isActive: true },
      });

      if (!school || !school.isActive) {
        throw new Error('Invalid or inactive school reference');
      }

      return {
        counsellorId: school.counsellorId,
        schoolId: school.id,
      };
    }

    default:
      throw new Error('Unsupported reference code type');
  }
};

module.exports = {
  generateUniqueReferenceCode,
  resolveReferenceCode,
};