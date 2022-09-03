import joi from "joi";

export const participantSchema = joi.object({
  name: joi.string().required(),
});

export const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});
