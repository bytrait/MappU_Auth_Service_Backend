const { z } = require('zod');

const sendOtpSchema = z.object({
    email: z.string().email({ message: 'Invalid email format' }),
});

const verifyOtpSchema = z.object({
    email: z.string().email({ message: 'Invalid email format' }),
    otp: z.string().length(6, { message: 'OTP must be 6 digits' }),
});

const referenceCodeSchema = z
    .string()
    .trim()
    .min(4, 'Reference code must be at least 4 characters')
    .max(20, 'Reference code must be at most 20 characters')
    .regex(
        /^[A-Za-z0-9]+$/,
        'Reference code must contain only letters and numbers'
    )
    .transform((val) => val.toUpperCase());

const registerSchema = z
    .object({
        fullName: z.string().min(2, 'Full name is required'),

        email: z.string().email('Invalid email format'),

        contact: z
            .string()
            .regex(/^[6-9]\d{9}$/, 'Invalid Indian contact number'),

        role: z.enum(['STUDENT', 'COUNSELLOR', 'INSTITUTION']),

        referenceCode: referenceCodeSchema.optional(),

        // Optional for students — derived from the reference token on the server.
        // Legacy clients may still send these; server validates they match the token.
        registrationType: z.enum(['INDIVIDUAL', 'SCHOOL']).optional(),

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
        }
    });

module.exports = {
    sendOtpSchema,
    verifyOtpSchema,
    registerSchema,
    referenceCodeSchema,
};
