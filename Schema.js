import joi from "joi";

export const participantSchema = joi.object({
  name: joi.string().required(),
});

export const messageSchema = joi.object({});
