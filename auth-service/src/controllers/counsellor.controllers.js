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
} = require('../services/counsellor.service');


const getCounsellorReferenceCodeController = async (req, res) => {
  try {
    const { id, role } = req.user;

    // Extra safety (route should already be protected)
    if (role !== 'COUNSELLOR') {
      return res.status(403).json({
        success: false,
        message: 'Only counsellors can access reference code',
      });
    }

    const referenceCode = await getCounsellorReferenceCodeService(id);

    return res.status(200).json({
      success: true,
      data: referenceCode, // { code }
    });
  } catch (error) {
    logger.error('Get counsellor reference code failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch reference code',
    });
  }
};

/**
 * -----------------------------
 * CREATE SCHOOL
 * -----------------------------
 */
const createSchool = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;
    const { name } = req.body;

    const school = await createSchoolService({ counsellorId, name });

    res.status(201).json({
      message: "School created successfully",
      data: school,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------
 * LIST SCHOOLS
 * -----------------------------
 */
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

/**
 * -----------------------------
 * UPDATE SCHOOL
 * -----------------------------
 */
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

/**
 * -----------------------------
 * GET STUDENTS OF A SCHOOL
 * -----------------------------
 */
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

/**
 * -----------------------------
 * GET DIRECT (NO SCHOOL) STUDENTS
 * -----------------------------
 */
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

/**
 * -----------------------------
 * ASSIGN STUDENT TO SCHOOL
 * -----------------------------
 */
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

/**
 * -----------------------------
 * REMOVE STUDENT FROM SCHOOL
 * -----------------------------
 */
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

/**
 * -----------------------------
 * GET SCHOOL REFERENCE CODE
 * -----------------------------
 */
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

/**
 * -----------------------------
 * ROTATE SCHOOL REFERENCE CODE
 * -----------------------------
 */
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

const rotateCounsellorReferenceCode = async (req, res, next) => {
  try {
    const counsellorId = req.user.id;

    const code = await rotateCounsellorReferenceCodeService({
      counsellorId,
    });

    res.json({
      message: "Counsellor reference code rotated successfully",
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

    res.json({
      message: "Welcome shown marked successfully",
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
};