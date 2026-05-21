const internalService = require('../services/internal.service');

const getBasicUserDetails = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const user = await internalService.getBasicUserDetails(studentId);

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const sendPaymentReceiptEmail = async (req, res, next) => {
  try {
    await internalService.sendPaymentReceiptEmail(req.body);

    return res.status(200).json({
      success: true,
      message: 'Payment receipt email sent successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBasicUserDetails,
  sendPaymentReceiptEmail,
};