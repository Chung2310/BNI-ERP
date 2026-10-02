import Joi from "joi";
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? helpers.error("any.invalid") : value;
});
export const createFeeInput = Joi.object({
  campaignId: Joi.string().guid({ version: "uuidv4" }).optional(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  title: Joi.string().trim().min(2).max(150).required(),
  amount: Joi.number().integer().min(1).max(1_000_000_000_000).required(),
  dueDate: day.required(), note: Joi.string().trim().max(1000).allow("").default(""),
  memberIds: Joi.array().items(Joi.string().hex().length(24)).min(1).max(1000).unique().required(),
});
export const feePaymentInput = Joi.object({
  id: Joi.string().guid({ version: "uuidv4" }).required(),
  amount: Joi.number().integer().min(1).max(1_000_000_000_000).required(),
  paidOn: day.required(), method: Joi.string().valid("cash", "transfer").required(),
  reference: Joi.string().trim().max(150).allow("").default(""),
  note: Joi.string().trim().max(1000).allow("").default(""),
});
export const voidFeePaymentInput = Joi.object({ reason: Joi.string().trim().min(3).max(500).required() });
