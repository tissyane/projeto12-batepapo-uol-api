import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import { participantSchema, messageSchema } from "./Schema.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = "5000";

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("Novo");
});

function isUser(username) {
  const loggedUser = db.collection("participants").findOne({ name: username });
  return loggedUser;
}

const timeNow = Date.now();
const time = dayjs(timeNow).format("HH:mm:ss");
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
      await db
        .collection("participants")
        .insertOne({ name: name, lastStatus: time });
      await db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: time,
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

/* Messages Routes */

app.post("/messages", async (req, res) => {
  const from = req.headers.user;
  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const messageError = validation.error.details.map(
      (detail) => detail.message
    );
    res.status(422).send(messageError);
    return;
  }
  const loggedUser = await isUser(from);
  if (!loggedUser) {
    res.status(422).send("Faça login novamente para continuar batendo papo");
    return;
  }

  try {
    await db.collection("messages").insertOne({
      from,
      ...req.body,
      time,
    });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/messages", async (req, res) => {
  try {
    const allMessages = await db.collection("messages").find().toArray();
    res.send(allMessages);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(port, () => console.log("Server listening on 5000"));
TODO: "Checar essa mensagem";
