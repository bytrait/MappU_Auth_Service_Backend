const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const {
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
} = require('../controllers/counsellor.controllers');

const counsellorOnly = [requireAuth, requireRole('COUNSELLOR')];

// ---------------------------------
// LEGACY: single reference code
// ---------------------------------
router.get('/reference-code', ...counsellorOnly, getCounsellorReferenceCodeController);
router.post('/reference-code/rotate', ...counsellorOnly, rotateCounsellorReferenceCode);

// ---------------------------------
// NEW: multi-token API (counsellor)
// ---------------------------------
router.post('/reference-tokens', ...counsellorOnly, createCounsellorReferenceToken);
router.get('/reference-tokens', ...counsellorOnly, listCounsellorReferenceTokens);

// ---------------------------------
// SCHOOL MANAGEMENT
// ---------------------------------
router.post('/schools', ...counsellorOnly, createSchool);
router.get('/schools', ...counsellorOnly, listSchools);
router.patch('/schools/:schoolId', ...counsellorOnly, updateSchool);

// ---------------------------------
// SCHOOL → STUDENTS
// ---------------------------------
router.get('/schools/:schoolId/students', ...counsellorOnly, getSchoolStudents);
router.get('/schools/direct-students', ...counsellorOnly, getDirectStudents);
router.post('/schools/:schoolId/students/:studentId', ...counsellorOnly, assignStudentToSchool);
router.delete('/schools/students/:studentId', ...counsellorOnly, removeStudentFromSchool);

// ---------------------------------
// LEGACY: single school reference code
// ---------------------------------
router.get('/schools/:schoolId/reference-code', ...counsellorOnly, getSchoolReferenceCode);
router.post('/schools/:schoolId/reference-code/rotate', ...counsellorOnly, rotateSchoolReferenceCode);

// ---------------------------------
// NEW: multi-token API (school)
// ---------------------------------
router.post('/schools/:schoolId/reference-tokens', ...counsellorOnly, createSchoolReferenceToken);
router.get('/schools/:schoolId/reference-tokens', ...counsellorOnly, listSchoolReferenceTokens);

// ---------------------------------
// NEW: generic token lifecycle (extend / update-price / deactivate)
// Works for both counsellor & school tokens; ownership is checked in service.
// ---------------------------------
router.patch('/reference-tokens/:tokenId/extend', ...counsellorOnly, extendReferenceToken);
router.patch('/reference-tokens/:tokenId/price', ...counsellorOnly, updateReferenceTokenPrice);
router.patch('/reference-tokens/:tokenId/deactivate', ...counsellorOnly, deactivateReferenceToken);

// ---------------------------------
// MARK WELCOME SHOWN
// ---------------------------------
router.post('/welcome-shown/mark', ...counsellorOnly, markWelcomeShown);

module.exports = router;
