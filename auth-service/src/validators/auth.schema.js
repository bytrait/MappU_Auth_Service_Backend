const { z } = require('zod');

const sendOtpSchema = z.object({
    email: z.string().email({ message: 'Invalid email format' }),
});

const verifyOtpSchema = z.object({
    email: z.string().email({ message: 'Invalid email format' }),
    otp: z.string().length(6, { message: 'OTP must be 6 digits' }),
});

// auth.schema.js

const registerSchema = z
    .object({
        fullName: z.string().min(2, 'Full name is required'),

        email: z.string().email('Invalid email format'),

        contact: z
            .string()
            .regex(/^[6-9]\d{9}$/, 'Invalid Indian contact number'),

        role: z.enum(['STUDENT', 'COUNSELLOR', 'INSTITUTION']),

        referenceCode: z
            .string()
            .length(6, 'Reference code must be 6 characters')
            .optional(),

        registrationType: z
            .enum(['INDIVIDUAL', 'SCHOOL'])
            .optional(),

        selectedSchoolId: z
            .union([
                z.string().uuid('Invalid school selection'),
                z.literal(''),
                z.undefined(),
            ])
            .optional(),
    })
    .superRefine((data, ctx) => {
        if (data.role === 'STUDENT') {
            if (!data.referenceCode) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['referenceCode'],
                    message: 'Reference code is required for student registration',
                });
            }

            if (!data.registrationType) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['registrationType'],
                    message: 'Registration type is required',
                });
            }

            if (
                data.registrationType === 'SCHOOL' &&
                !data.selectedSchoolId
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['selectedSchoolId'],
                    message: 'Please select a school',
                });
            }
        }
    });

module.exports = {
    sendOtpSchema,
    verifyOtpSchema,
    registerSchema,
};