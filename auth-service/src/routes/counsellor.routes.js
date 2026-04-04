const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getCounsellorReferenceCodeController,
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
} = require('../controllers/counsellor.controllers');

router.get('/reference-code', requireAuth, requireRole('COUNSELLOR'), getCounsellorReferenceCodeController);
router.post(
    "/reference-code/rotate",
    requireAuth,
    requireRole("COUNSELLOR"),
    rotateCounsellorReferenceCode
);

// ---------------------------------
// SCHOOL MANAGEMENT
// ---------------------------------
router.post(
    "/schools",
    requireAuth,
    requireRole("COUNSELLOR"),
    createSchool
);

router.get(
    "/schools",
    requireAuth,
    requireRole("COUNSELLOR"),
    listSchools
);

router.patch(
    "/schools/:schoolId",
    requireAuth,
    requireRole("COUNSELLOR"),
    updateSchool
);

// ---------------------------------
// SCHOOL → STUDENTS
// ---------------------------------
router.get(
    "/schools/:schoolId/students",
    requireAuth,
    requireRole("COUNSELLOR"),
    getSchoolStudents
);

router.get(
    "/schools/direct-students",
    requireAuth,
    requireRole("COUNSELLOR"),
    getDirectStudents
);

router.post(
    "/schools/:schoolId/students/:studentId",
    requireAuth,
    requireRole("COUNSELLOR"),
    assignStudentToSchool
);

router.delete(
    "/schools/students/:studentId",
    requireAuth,
    requireRole("COUNSELLOR"),
    removeStudentFromSchool
);

// ---------------------------------
// SCHOOL REFERENCE CODE
// ---------------------------------
router.get(
    "/schools/:schoolId/reference-code",
    requireAuth,
    requireRole("COUNSELLOR"),
    getSchoolReferenceCode
);

router.post(
    "/schools/:schoolId/reference-code/rotate",
    requireAuth,
    requireRole("COUNSELLOR"),
    rotateSchoolReferenceCode
);

// ---------------------------------
// MARK WELCOME SHOWN
// ---------------------------------
router.post(
    "/welcome-shown/mark",
    requireAuth,
    requireRole("COUNSELLOR"),
    markWelcomeShown
);


module.exports = router;