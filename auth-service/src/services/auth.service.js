const { logger } = require("../config/logger");
const prisma = require("../prisma/prisma");
const { generateToken } = require("../utils/jwt.util");
const { sendOtpEmail } = require("../utils/mailer.util");
const {
  setOtp,
  getOtp,
  setEmailVerified,
  deleteOtp,
  isEmailVerified,
  deleteEmailVerifiedFlag,
  generateOtp,
} = require("../utils/otp.util");

const {
  generateUniqueReferenceCode,
  normalizeReferenceCodeInput,
  resolveReferenceCode,
} = require("../utils/referenceCode");

const {
  createStudentPaymentRecord,
} = require('../utils/studentPaymentClient.util');
const { grantSignupCredits } = require('../utils/billingClient.util');

const {
  badRequest,
  conflict,
  notFound,
} = require('../utils/HttpError');

/**
 * -----------------------------
 * LOGIN OTP
 * -----------------------------
 */
const sendLoginOtpService = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found. Please register.");

  const otp = generateOtp();
  setOtp(email, otp);
  sendOtpEmail(email, otp, 'login');

  logger.info(`Login OTP sent to ${email}`);
  return { email };
};

const verifyLoginOtpService = async (email, otp) => {
  const storedOtp = await getOtp(email);
  if (!storedOtp || storedOtp !== otp) {
    throw new Error("Invalid or expired OTP");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");

  await deleteOtp(email);

  const token = generateToken({
    id: user.id,
    fullName: user.fullName,
    contact: user.contact,
    email: user.email,
    role: user.role,
  });

  return { user, token };
};

/**
 * -----------------------------
 * REGISTER OTP
 * -----------------------------
 */
const sendRegisterOtpService = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) throw new Error("Email already registered. Try logging in.");

  const otp = generateOtp();
  setOtp(email, otp);
  sendOtpEmail(email, otp, 'registration');

  logger.info(`Register OTP sent to ${email}`);
  return { email };
};

const verifyRegisterOtp = async (email, otp) => {
  const storedOtp = await getOtp(email);

  if (!storedOtp) throw new Error("OTP expired or not found");
  if (storedOtp !== otp) throw new Error("Invalid OTP");

  await setEmailVerified(email);
  await deleteOtp(email);

  logger.info(`✅ Register OTP verified for ${email}`);
  return { verified: true };
};

/**
 * Resolve a reference code into registration context for student signup.
 * The token type (COUNSELLOR vs SCHOOL) determines registrationType and
 * school — students must not pick a different school than the token implies.
 */
const buildRegistrationContextFromCode = async (referenceCode) => {
  const normalizedCode = normalizeReferenceCodeInput(referenceCode);
  const resolved = await resolveReferenceCode(normalizedCode);

  const token = await prisma.referenceCode.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      type: true,
      label: true,
      targetId: true,
    },
  });

  if (!token) {
    throw notFound('Invalid reference code', { code: 'CODE_INVALID' });
  }

  let registrationType;
  let schoolId = null;
  let schoolName = null;

  if (token.type === 'SCHOOL') {
    registrationType = 'SCHOOL';
    schoolId = resolved.schoolId;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, isActive: true },
    });

    if (!school || !school.isActive) {
      throw notFound('Invalid or inactive school reference', {
        code: 'SCHOOL_INACTIVE',
      });
    }
    schoolName = school.name;
  } else if (token.type === 'COUNSELLOR') {
    registrationType = 'INDIVIDUAL';
    schoolId = null;
    schoolName = null;
  } else {
    throw badRequest('Unsupported reference code type');
  }

  const counsellor = await prisma.user.findUnique({
    where: { id: resolved.counsellorId },
    select: { id: true, fullName: true },
  });

  if (!counsellor) {
    throw notFound('Counsellor not found');
  }

  return {
    referenceCode: normalizedCode,
    referenceCodeId: token.id,
    tokenType: token.type,
    tokenLabel: token.label,
    registrationType,
    counsellorId: counsellor.id,
    counsellorName: counsellor.fullName,
    schoolId,
    schoolName,
  };
};

/**
 * If the FE still sends registrationType / selectedSchoolId (legacy clients),
 * verify they match the token-derived values.
 */
const assertRegistrationPayloadMatchesToken = (
  context,
  { registrationType, selectedSchoolId }
) => {
  if (
    registrationType !== undefined &&
    registrationType !== null &&
    registrationType !== '' &&
    registrationType !== context.registrationType
  ) {
    throw conflict(
      'Registration type does not match this reference code',
      { code: 'REGISTRATION_TYPE_MISMATCH' }
    );
  }

  if (context.registrationType === 'SCHOOL') {
    if (
      selectedSchoolId !== undefined &&
      selectedSchoolId !== null &&
      selectedSchoolId !== '' &&
      selectedSchoolId !== context.schoolId
    ) {
      throw conflict(
        'Selected school does not match this reference code',
        { code: 'SCHOOL_MISMATCH' }
      );
    }
  }

  if (
    context.registrationType === 'INDIVIDUAL' &&
    selectedSchoolId !== undefined &&
    selectedSchoolId !== null &&
    selectedSchoolId !== ''
  ) {
    throw conflict(
      'This reference code is for individual registration only',
      { code: 'SCHOOL_NOT_ALLOWED' }
    );
  }
};

/**
 * -----------------------------
 * REGISTER USER
 * -----------------------------
 */

const registerUserService = async ({
  fullName,
  email,
  contact,
  role,
  referenceCode,
  registrationType,
  selectedSchoolId,
  requestId,
}) => {
  const verified = await isEmailVerified(email);

  if (!verified) {
    throw new Error('Email is not verified via OTP');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  let counsellorId = null;
  let schoolId = null;
  let institutionId = null;

  if (role === 'STUDENT') {
    if (!referenceCode) {
      throw badRequest('Reference code is required for student registration');
    }

    const regContext = await buildRegistrationContextFromCode(referenceCode);
    assertRegistrationPayloadMatchesToken(regContext, {
      registrationType,
      selectedSchoolId,
    });

    counsellorId = regContext.counsellorId;
    schoolId = regContext.schoolId;
    const schoolName = regContext.schoolName;
    const effectiveRegistrationType = regContext.registrationType;
    const normalizedReferenceCode = regContext.referenceCode;

    const userData = {
      fullName,
      email,
      contact,
      role,
      registrationType: effectiveRegistrationType,
    };

    if (schoolId) {
      userData.school = {
        connect: {
          id: schoolId,
        },
      };
    }

    if (institutionId) {
      userData.institution = {
        connect: {
          id: institutionId,
        },
      };
    }

    if (counsellorId) {
      userData.counsellor = {
        connect: {
          id: counsellorId,
        },
      };
    }

    const user = await prisma.user.create({
      data: userData,
    });

    const payment = await createStudentPaymentRecord({
      studentId: user.id,
      counsellorId,
      registrationType: effectiveRegistrationType,
      schoolId,
      schoolName,
      referenceCode: normalizedReferenceCode,
      referenceCodeId: regContext.referenceCodeId,
      requestId,
    });

    await deleteEmailVerifiedFlag(email);

    logger.info('Student registered successfully', {
      requestId,
      userId: user.id,
      counsellorId,
      schoolId,
      registrationType: effectiveRegistrationType,
      referenceCode: normalizedReferenceCode,
      referenceCodeId: regContext.referenceCodeId,
      paymentStatus: payment?.status,
      paymentAmount: payment?.amount,
    });

    const token = generateToken({
      id: user.id,
      fullName: user.fullName,
      contact: user.contact,
      email: user.email,
      role: user.role,
    });

    return { user, token, payment };
  }

  const userData = {
    fullName,
    email,
    contact,
    role,
  };

  if (schoolId) {
    userData.school = {
      connect: {
        id: schoolId,
      },
    };
  }

  if (institutionId) {
    userData.institution = {
      connect: {
        id: institutionId,
      },
    };
  }

  if (counsellorId) {
    userData.counsellor = {
      connect: {
        id: counsellorId,
      },
    };
  }

  const user = await prisma.user.create({
    data: userData,
  });

  if (role === 'COUNSELLOR') {
    const code = await generateUniqueReferenceCode();

    await prisma.referenceCode.create({
      data: {
        code,
        type: 'COUNSELLOR',
        targetId: user.id,
      },
    });

    await grantSignupCredits({
      counsellorId: user.id,
      requestId,
    });

    logger.info('Reference code + signup credits granted', {
      requestId,
      email,
      userId: user.id,
    });
  }

  await deleteEmailVerifiedFlag(email);

  logger.info('User registered successfully', {
    requestId,
    email,
    role,
    userId: user.id,
  });

  const token = generateToken({
    id: user.id,
    fullName: user.fullName,
    contact: user.contact,
    email: user.email,
    role: user.role,
  });

  return { user, token };
};


/**
 * -----------------------------
 * GET USER
 * -----------------------------
 */
const getUserByIdService = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

/**
 * -----------------------------
 * COUNSELLOR → STUDENTS
 * -----------------------------
 */
const getCounsellorStudentsService = async ({
  counsellorId,
  page = 1,
  limit = 20,
  search = "",
}) => {
  const skip = (page - 1) * limit;

  const whereClause = {
    role: "STUDENT",
    counsellorId,
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
        schoolId: true,
        institutionId: true,
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
 * -----------------------------
 * VERIFY STUDENT OWNERSHIP
 * -----------------------------
 */
const verifyStudentOwnershipService = async (counsellorId, studentId) => {
  if (!counsellorId || !studentId) {
    return false;
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: "STUDENT",
      counsellorId,
    },
    select: { id: true },
  });

  return !!student;
};

const getCurrentUserService = async ({ userId }) => {

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      contact: true,
      role: true,
      welcomeShown: true,
      createdAt: true
    }
  });

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
};


/**
 * Token-centric preview for student registration.
 * School tokens → show that school only. Counsellor tokens → individual only.
 * No school/individual picker list.
 */
const getReferenceCodeDetailsService = async (referenceCode) => {
  if (!referenceCode) {
    throw badRequest('Reference code is required');
  }

  const ctx = await buildRegistrationContextFromCode(referenceCode);

  const isSchoolToken = ctx.tokenType === 'SCHOOL';

  return {
    referenceCode: ctx.referenceCode,
    referenceCodeId: ctx.referenceCodeId,
    tokenType: ctx.tokenType,
    tokenLabel: ctx.tokenLabel,
    registrationType: ctx.registrationType,
    counsellorId: ctx.counsellorId,
    counsellorName: ctx.counsellorName,
    schoolId: ctx.schoolId,
    schoolName: ctx.schoolName,
    display: {
      title: isSchoolToken ? ctx.schoolName : null,
      subtitle: ctx.tokenLabel || null,
      showSchoolPicker: false,
      showSchoolName: isSchoolToken,
    },
  };
};


module.exports = {
  sendLoginOtpService,
  verifyLoginOtpService,
  sendRegisterOtpService,
  verifyRegisterOtp,
  registerUserService,
  getUserByIdService,
  getCounsellorStudentsService,
  verifyStudentOwnershipService,
  getCurrentUserService,
  getReferenceCodeDetailsService
};