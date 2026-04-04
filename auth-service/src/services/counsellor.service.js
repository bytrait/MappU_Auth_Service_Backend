const prisma = require("../prisma/prisma");
const { generateUniqueReferenceCode } = require("../utils/referenceCode");

/**
 * Rotate counsellor's reference code
 * @param {string} counsellorId
 * @returns {Promise<{code: string}>}
 */
const rotateCounsellorReferenceCodeService = async ({ counsellorId }) => {
  if (!counsellorId) {
    throw new Error("Counsellor ID is required");
  }

  // Check if counsellor user exists
  const counsellor = await prisma.user.findUnique({
    where: { id: counsellorId },
  });

  if (!counsellor || counsellor.role !== "COUNSELLOR") {
    throw new Error("Counsellor not found");
  }

  // Deactivate existing active reference codes
  await prisma.referenceCode.updateMany({
    where: {
      targetId: counsellorId,
      type: "COUNSELLOR",
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Generate new code
  const newCode = await generateUniqueReferenceCode();

  // Create new active reference code
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


/**
 * Get active reference code for a counsellor
 *
 * @param {string} counsellorId
 * @returns {Promise<{ code: string }>}
 */
const getCounsellorReferenceCodeService = async (counsellorId) => {
  if (!counsellorId) {
    throw new Error("Counsellor ID is required");
  }

  const reference = await prisma.referenceCode.findFirst({
    where: {
      targetId: counsellorId,
      type: "COUNSELLOR",
      isActive: true,
    },
    select: {
      code: true,
    },
  });

  if (!reference) {
    throw new Error("Reference code not found for counsellor");
  }

  return reference;
};


/**
 * Create a school for a counsellor
 */
const createSchoolService = async ({ counsellorId, name }) => {
  if (!name) {
    throw new Error("School name is required");
  }

  const school = await prisma.school.create({
    data: {
      name,
      counsellorId,
    },
  });

  // auto-generate SCHOOL reference code
  const code = await generateUniqueReferenceCode();

  await prisma.referenceCode.create({
    data: {
      code,
      type: "SCHOOL",
      targetId: school.id,
    },
  });

  return school;
};

/**
 * List all schools for a counsellor
 */
const listSchoolsService = async ({ counsellorId }) => {
  return prisma.school.findMany({
    where: { counsellorId },
    orderBy: { createdAt: "desc" },
    include: {
      students: {
        select: { id: true },
      },
    },
  });
};

/**
 * Update school (name / active)
 */
const updateSchoolService = async ({
  counsellorId,
  schoolId,
  name,
  isActive,
}) => {
  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      counsellorId,
    },
  });

  if (!school) {
    throw new Error("School not found or access denied");
  }

  return prisma.school.update({
    where: { id: schoolId },
    data: {
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
    },
  });
};
/**
 * Get students under a specific school
 */
const getSchoolStudentsService = async ({
  counsellorId,
  schoolId,
  page = 1,
  limit = 20,
  search = "",
}) => {
  const skip = (page - 1) * limit;

  // ownership check
  const school = await prisma.school.findFirst({
    where: { id: schoolId, counsellorId },
    select: { id: true },
  });

  if (!school) {
    throw new Error("School not found or access denied");
  }

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
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};


/**
 * Get students without school (direct students)
 */
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
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Assign student to a school
 */
const assignStudentToSchoolService = async ({
  counsellorId,
  schoolId,
  studentId,
}) => {
  // verify school ownership
  const school = await prisma.school.findFirst({
    where: { id: schoolId, counsellorId, isActive: true },
    select: { id: true },
  });

  if (!school) {
    throw new Error("School not found or inactive");
  }

  // verify student ownership
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: "STUDENT",
      counsellorId,
    },
  });

  if (!student) {
    throw new Error("Student not found or access denied");
  }

  return prisma.user.update({
    where: { id: studentId },
    data: { schoolId },
  });
};

/**
 * Remove student from school
 */
const removeStudentFromSchoolService = async ({
  counsellorId,
  studentId,
}) => {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: "STUDENT",
      counsellorId,
    },
  });

  if (!student) {
    throw new Error("Student not found or access denied");
  }

  return prisma.user.update({
    where: { id: studentId },
    data: { schoolId: null },
  });
};

/**
 * Get school reference code
 */
const getSchoolReferenceCodeService = async ({
  counsellorId,
  schoolId,
}) => {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, counsellorId },
    select: { id: true },
  });

  if (!school) {
    throw new Error("School not found or access denied");
  }

  return prisma.referenceCode.findFirst({
    where: {
      type: "SCHOOL",
      targetId: schoolId,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      createdAt: true,
    },
  });
};

/**
 * Rotate school reference code
 */
const rotateSchoolReferenceCodeService = async ({
  counsellorId,
  schoolId,
}) => {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, counsellorId },
  });

  if (!school) {
    throw new Error("School not found or access denied");
  }

  // deactivate old codes
  await prisma.referenceCode.updateMany({
    where: {
      type: "SCHOOL",
      targetId: schoolId,
      isActive: true,
    },
    data: { isActive: false },
  });

  const code = await generateUniqueReferenceCode();

  return prisma.referenceCode.create({
    data: {
      code,
      type: "SCHOOL",
      targetId: schoolId,
    },
  });
};

const markWelcomeShownService = async ({ counsellorId }) => {
  try {
    await prisma.user.update({
      where: { id: counsellorId },
      data: { welcomeShown: true }
    });

    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCounsellorReferenceCodeService,
  rotateCounsellorReferenceCodeService,
  createSchoolService,
  listSchoolsService,
  updateSchoolService,
  getSchoolStudentsService,
  getDirectStudentsService,
  assignStudentToSchoolService,
  removeStudentFromSchoolService,
  getSchoolReferenceCodeService,
  rotateSchoolReferenceCodeService,
  markWelcomeShownService
  };
