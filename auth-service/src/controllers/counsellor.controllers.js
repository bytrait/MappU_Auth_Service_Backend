const {
  getCounsellorReferenceCodeService,
  createSchoolService,
  listSchoolsService,
  updateSchoolService,
  getSchoolStudentsService,
  getDirectStudentsService,
  assignStudentToSchoolService,
  removeStudentFromSchoolService,
  getSchoolReferenceCodeService,
  rotateSchoolReferenceCodeService,
  rotateCounsellorReferenceCodeService,
  markWelcomeShownService,
  createCounsellorReferenceTokenService,
  listCounsellorReferenceTokensService,
  createSchoolReferenceTokenService,
  listSchoolReferenceTokensService,
  extendReferenceTokenService,
  updateReferenceTokenPriceService,
  deactivateReferenceTokenService,
} = require('../services/counsellor.service');
const { forbidden } = require('../utils/HttpError');

const requestIdFrom = (req) =>
  req.headers['x-request-id'] || req.id || undefined;

// ---------------------------------------------------------------------------
// Legacy single-code endpoints
// ---------------------------------------------------------------------------

const getCounsellorReferenceCodeController = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role !== 'COUNSELLOR') {
      throw forbidden('Only counsellors can access reference code');
    }

    const referenceCode = await getCounsellorReferenceCodeService(id);

    res.status(200).json({
      success: true,
      data: referenceCode,
    });
  } catch (error) {
    next(error);
  }
};

const rotateCounsellorReferenceCode = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const code = await rotateCounsellorReferenceCodeService({ counsellorId });
    res.json({
      message: "Counsellor reference code rotated successfully",
      data: code,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// School CRUD
// ---------------------------------------------------------------------------

const createSchool = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const {
      name,
      tokenCode,
      tokenLabel,
      tokenStartDate,
      tokenExpiryDate,
      price,
      currency,
    } = req.body;

    const school = await createSchoolService({
      counsellorId,
      name,
      tokenCode,
      tokenLabel,
      tokenStartDate,
      tokenExpiryDate,
      price,
      currency,
      requestId: requestIdFrom(req),
    });

    res.status(201).json({
      message: "School created successfully",
      data: school,
    });
  } catch (error) {
    next(error);
  }
};

const listSchools = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const schools = await listSchoolsService({ counsellorId });

    res.json({
      data: schools.map((school) => ({
        id: school.id,
        name: school.name,
        isActive: school.isActive,
        studentsCount: school.students.length,
        createdAt: school.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const updateSchool = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId } = req.params;
    const { name, isActive } = req.body;

    const school = await updateSchoolService({
      counsellorId,
      schoolId,
      name,
      isActive,
    });

    res.json({
      message: "School updated successfully",
      data: school,
    });
  } catch (error) {
    next(error);
  }
};

const getSchoolStudents = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId } = req.params;
    const { page, limit, search } = req.query;

    const result = await getSchoolStudentsService({
      counsellorId,
      schoolId,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search || "",
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getDirectStudents = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { page, limit, search } = req.query;

    const result = await getDirectStudentsService({
      counsellorId,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search || "",
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const assignStudentToSchool = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId, studentId } = req.params;

    const student = await assignStudentToSchoolService({
      counsellorId,
      schoolId,
      studentId,
    });

    res.json({
      message: "Student assigned to school successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

const removeStudentFromSchool = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { studentId } = req.params;

    const student = await removeStudentFromSchoolService({
      counsellorId,
      studentId,
    });

    res.json({
      message: "Student removed from school successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

const getSchoolReferenceCode = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId } = req.params;

    const code = await getSchoolReferenceCodeService({
      counsellorId,
      schoolId,
    });

    res.json({ data: code });
  } catch (error) {
    next(error);
  }
};

const rotateSchoolReferenceCode = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId } = req.params;

    const code = await rotateSchoolReferenceCodeService({
      counsellorId,
      schoolId,
    });

    res.json({
      message: "School reference code rotated successfully",
      data: code,
    });
  } catch (error) {
    next(error);
  }
};

const markWelcomeShown = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    await markWelcomeShownService({ counsellorId });
    res.json({ message: "Welcome shown marked successfully" });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// NEW: multi-token controllers
// ---------------------------------------------------------------------------

const createCounsellorReferenceToken = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { code, label, startDate, expiryDate, price, currency } = req.body;

    const token = await createCounsellorReferenceTokenService({
      counsellorId,
      code,
      label,
      startDate,
      expiryDate,
      price,
      currency,
      requestId: requestIdFrom(req),
    });

    res.status(201).json({
      message: "Reference token created successfully",
      data: token,
    });
  } catch (error) {
    next(error);
  }
};

const listCounsellorReferenceTokens = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const includeInactive = req.query.includeInactive === 'true';

    const tokens = await listCounsellorReferenceTokensService({
      counsellorId,
      includeInactive,
    });

    res.json({ data: tokens });
  } catch (error) {
    next(error);
  }
};

const createSchoolReferenceToken = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId } = req.params;
    const { code, label, startDate, expiryDate, price, currency } = req.body;

    const token = await createSchoolReferenceTokenService({
      counsellorId,
      schoolId,
      code,
      label,
      startDate,
      expiryDate,
      price,
      currency,
      requestId: requestIdFrom(req),
    });

    res.status(201).json({
      message: "School reference token created successfully",
      data: token,
    });
  } catch (error) {
    next(error);
  }
};

const listSchoolReferenceTokens = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { schoolId } = req.params;
    const includeInactive = req.query.includeInactive === 'true';

    const tokens = await listSchoolReferenceTokensService({
      counsellorId,
      schoolId,
      includeInactive,
    });

    res.json({ data: tokens });
  } catch (error) {
    next(error);
  }
};

const extendReferenceToken = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { tokenId } = req.params;
    const { expiryDate, price, currency } = req.body;

    const token = await extendReferenceTokenService({
      counsellorId,
      tokenId,
      expiryDate,
      price,
      currency,
      requestId: requestIdFrom(req),
    });

    res.json({
      message: "Reference token extended successfully",
      data: token,
    });
  } catch (error) {
    next(error);
  }
};

const updateReferenceTokenPrice = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { tokenId } = req.params;
    const { price, currency } = req.body;

    const result = await updateReferenceTokenPriceService({
      counsellorId,
      tokenId,
      price,
      currency,
      requestId: requestIdFrom(req),
    });

    res.json({
      message: "Reference token price updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const deactivateReferenceToken = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { tokenId } = req.params;

    const token = await deactivateReferenceTokenService({
      counsellorId,
      tokenId,
      requestId: requestIdFrom(req),
    });

    res.json({
      message: "Reference token deactivated successfully",
      data: token,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCounsellorReferenceCodeController,
  createSchool,
  listSchools,
  updateSchool,
  getSchoolStudents,
  getDirectStudents,
  assignStudentToSchool,
  removeStudentFromSchool,
  getSchoolReferenceCode,
  rotateSchoolReferenceCode,
  rotateCounsellorReferenceCode,
  markWelcomeShown,

  createCounsellorReferenceToken,
  listCounsellorReferenceTokens,
  createSchoolReferenceToken,
  listSchoolReferenceTokens,
  extendReferenceToken,
  updateReferenceTokenPrice,
  deactivateReferenceToken,
};
