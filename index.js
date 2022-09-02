import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
// import dotenv from "dotenv"; TODO: Conectar o dotenv
// dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = "5000";

const mongoClient = new MongoClient("mongodb://localhost:27017");

let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("test");
});

const participantSchema = joi.object({
  name: joi.string().required(),
});

function isUser(participant) {
  const loggedUser = db
    .collection("participants")
    .findOne({ name: participant });
  return loggedUser;
}

/* Participants Routes */

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const validation = participantSchema.validate({ name }, { abortEarly: true });
  if (validation.error) {
    const error = validation.error.details[0].message;
    res.status(422).send(error);
    return;
  }
  const loggedUser = await isUser(name);
  if (loggedUser) {
    res.sendStatus(409);
    return;
  } else {
    try {
      await db
        .collection("participants")
        .insertOne({ name: name, lastStatus: name });
      await db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
      });
      res.sendStatus(201);
    } catch (err) {
      res.status(500).send(err);
    }
  }
});

app.listen(port, () => console.log("Server listening on 5000"));
