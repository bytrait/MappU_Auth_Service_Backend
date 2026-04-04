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
  resolveReferenceCode,
} = require("../utils/referenceCode");

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
  sendOtpEmail(email, otp);

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
  sendOtpEmail(email, otp);

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
  requestId
}) => {

  // -----------------------------
  // Email verification check
  // -----------------------------
  const verified = await isEmailVerified(email);
  if (!verified) {
    throw new Error("Email is not verified via OTP");
  }

  // -----------------------------
  // Prevent duplicate users
  // -----------------------------
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  let counsellorId = null;
  let schoolId = null;
  let institutionId = null;

  // -----------------------------
  // STUDENT FLOW
  // -----------------------------
  if (role === "STUDENT") {

    if (!referenceCode) {
      throw new Error("Reference code is required for student registration");
    }

    const resolved = await resolveReferenceCode(referenceCode);

    counsellorId = resolved.counsellorId;
    schoolId = resolved.schoolId;

    // -----------------------------
    // Validate School Active Status
    // -----------------------------
    if (schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { isActive: true }
      });

      if (!school || !school.isActive) {
        throw new Error("This school is not accepting registrations");
      }
    }

    const { consumeCredit, refundCredit } =
      require("../utils/billingClient.util");

    // -----------------------------
    // Step 1: Consume credit
    // -----------------------------
    console.log("Consuming credit for counsellorId:", counsellorId, "requestId:", requestId);
    await consumeCredit({
      counsellorId,
      requestId
    });


    logger.info("Credit consumed successfully", {
      requestId,
      counsellorId,
      email
    });

    try {

      // -----------------------------
      // Step 2: Create student
      // -----------------------------
      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          contact,
          role,
          counsellorId,
          schoolId,
          institutionId,
        },
      });

      await deleteEmailVerifiedFlag(email);

      logger.info("Student registered successfully", {
        requestId,
        userId: user.id,
        counsellorId
      });

      const token = generateToken({
        id: user.id,
        fullName: user.fullName,
        contact: user.contact,
        email: user.email,
        role: user.role,
      });

      return { user, token };

    } catch (error) {

      // -----------------------------
      // Compensation: Refund credit
      // -----------------------------
      await refundCredit({
        counsellorId,
        requestId
      });

      logger.error("Student registration failed — credit refunded", {
        requestId,
        counsellorId,
        error: error.message
      });

      throw error;
    }
  }

  // -----------------------------
  // NON-STUDENT FLOW (ADMIN, COUNSELLOR, etc.)
  // -----------------------------

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      contact,
      role,
      counsellorId,
      schoolId,
      institutionId,
    },
  });

  // Auto-generate reference code for counsellor
  if (role === "COUNSELLOR") {

    const code = await generateUniqueReferenceCode();
  
    await prisma.referenceCode.create({
      data: {
        code,
        type: "COUNSELLOR",
        targetId: user.id,
      },
    });
  
    const { grantSignupCredits } =
      require("../utils/billingClient.util");
  
    await grantSignupCredits({
      counsellorId: user.id,
      requestId
    });
  
    logger.info("Reference code + signup credits granted", {
      requestId,
      email,
      userId: user.id
    });
  }

  await deleteEmailVerifiedFlag(email);

  logger.info("User registered successfully", {
    requestId,
    email,
    role,
    userId: user.id
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
};