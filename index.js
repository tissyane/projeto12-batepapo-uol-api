import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
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

function isUser(username) {
  const loggedUser = db.collection("participants").findOne({ name: username });
  return loggedUser;
}

/* Participants Routes */

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const validation = participantSchema.validate({ name });
  if (validation.error) {
    const loginError = validation.error.details[0].message;
    res.status(422).send(loginError);
    return;
  }
  const loggedUser = await isUser(name);
  if (loggedUser) {
    res.sendStatus(409);
    return;
  } else {
    try {
      const loginTime = Date.now();
      await db
        .collection("participants")
        .insertOne({ name: name, lastStatus: loginTime });
      await db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(loginTime).format("HH:mm:ss"),
      });
      res.sendStatus(201);
    } catch (err) {
      res.status(500).send(err);
    }
  }
});

app.get("/participants", async (req, res) => {
  try {
    const allParticipants = await db
      .collection("participants")
      .find()
      .toArray();
    res.send(allParticipants);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(port, () => console.log("Server listening on 5000"));